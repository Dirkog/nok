import { useState } from "react";
import type { FormEvent } from "react";

type ToolId = "gcd" | "common" | "reduce" | "factor";

type Inputs = {
  gcdA: string;
  gcdB: string;
  commonN1: string;
  commonD1: string;
  commonN2: string;
  commonD2: string;
  reduceN: string;
  reduceD: string;
  factorN: string;
};

type Fraction = { numerator: bigint; denominator: bigint };

type CalculationResult =
  | { kind: "gcd"; gcd: bigint; lcm: bigint }
  | { kind: "common"; denominator: bigint; first: Fraction; second: Fraction }
  | { kind: "reduce"; reduced: Fraction }
  | { kind: "factor"; original: bigint; factors: [bigint, number][] };

const DEFAULT_INPUTS: Inputs = {
  gcdA: "",
  gcdB: "",
  commonN1: "",
  commonD1: "",
  commonN2: "",
  commonD2: "",
  reduceN: "",
  reduceD: "",
  factorN: "",
};

const TOOLS: { id: ToolId; label: string }[] = [
  { id: "gcd", label: "НОД и НОК" },
  { id: "common", label: "Общий знаменатель" },
  { id: "reduce", label: "Сократить дробь" },
  { id: "factor", label: "Простые множители" },
];

const MAX_FACTOR_INPUT = 18446744073709551615n;

function abs(value: bigint) {
  return value < 0n ? -value : value;
}

function fmt(value: bigint) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

function parseInteger(value: string) {
  const normalized = value.trim();
  if (!/^[+-]?\d+$/.test(normalized)) throw new Error("Введите целые числа.");
  return BigInt(normalized);
}

function gcd(left: bigint, right: bigint) {
  let a = abs(left);
  let b = abs(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function lcm(left: bigint, right: bigint) {
  if (left === 0n || right === 0n) return 0n;
  return (abs(left) / gcd(left, right)) * abs(right);
}

function normalizeFraction(numerator: bigint, denominator: bigint): Fraction {
  if (denominator === 0n) throw new Error("Знаменатель не может быть равен нулю.");
  if (denominator < 0n) return { numerator: -numerator, denominator: -denominator };
  return { numerator, denominator };
}

function modPow(base: bigint, exponent: bigint, modulus: bigint) {
  let result = 1n;
  let factor = base % modulus;
  let power = exponent;
  while (power > 0n) {
    if (power % 2n === 1n) result = (result * factor) % modulus;
    factor = (factor * factor) % modulus;
    power /= 2n;
  }
  return result;
}

function isPrime(value: bigint) {
  if (value < 2n) return false;
  for (const prime of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    if (value === prime) return true;
    if (value % prime === 0n) return false;
  }
  let oddPart = value - 1n;
  let powersOfTwo = 0;
  while (oddPart % 2n === 0n) {
    oddPart /= 2n;
    powersOfTwo += 1;
  }
  for (const base of [2n, 325n, 9375n, 28178n, 450775n, 9780504n, 1795265022n]) {
    const witness = base % value;
    if (witness === 0n) continue;
    let residue = modPow(witness, oddPart, value);
    if (residue === 1n || residue === value - 1n) continue;
    let passed = false;
    for (let round = 1; round < powersOfTwo; round += 1) {
      residue = (residue * residue) % value;
      if (residue === value - 1n) {
        passed = true;
        break;
      }
    }
    if (!passed) return false;
  }
  return true;
}

function pollardRho(value: bigint) {
  for (const prime of [2n, 3n, 5n, 7n, 11n, 13n]) if (value % prime === 0n) return prime;
  for (let constant = 1n; constant <= 24n; constant += 1n) {
    let slow = 2n;
    let fast = 2n;
    let divisor = 1n;
    const step = (n: bigint) => (n * n + constant) % value;
    for (let i = 0; i < 80000 && divisor === 1n; i += 1) {
      slow = step(slow);
      fast = step(step(fast));
      divisor = gcd(abs(slow - fast), value);
    }
    if (divisor > 1n && divisor < value) return divisor;
  }
  throw new Error("Не удалось разложить число.");
}

function factorize(value: bigint): [bigint, number][] {
  const primes: bigint[] = [];
  const visit = (part: bigint) => {
    if (part === 1n) return;
    if (isPrime(part)) {
      primes.push(part);
      return;
    }
    const divisor = pollardRho(part);
    visit(divisor);
    visit(part / divisor);
  };
  visit(value);
  primes.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const grouped: [bigint, number][] = [];
  for (const prime of primes) {
    const last = grouped[grouped.length - 1];
    if (last && last[0] === prime) last[1] += 1;
    else grouped.push([prime, 1]);
  }
  return grouped;
}

function calculate(tool: ToolId, inputs: Inputs): CalculationResult {
  if (tool === "gcd") {
    const a = parseInteger(inputs.gcdA);
    const b = parseInteger(inputs.gcdB);
    return { kind: "gcd", gcd: gcd(a, b), lcm: lcm(a, b) };
  }
  if (tool === "common") {
    const first = normalizeFraction(parseInteger(inputs.commonN1), parseInteger(inputs.commonD1));
    const second = normalizeFraction(parseInteger(inputs.commonN2), parseInteger(inputs.commonD2));
    const denominator = lcm(first.denominator, second.denominator);
    return {
      kind: "common",
      denominator,
      first: { numerator: first.numerator * (denominator / first.denominator), denominator },
      second: { numerator: second.numerator * (denominator / second.denominator), denominator },
    };
  }
  if (tool === "reduce") {
    const f = normalizeFraction(parseInteger(inputs.reduceN), parseInteger(inputs.reduceD));
    const d = gcd(f.numerator, f.denominator);
    return { kind: "reduce", reduced: { numerator: f.numerator / d, denominator: f.denominator / d } };
  }
  const original = parseInteger(inputs.factorN);
  const magnitude = abs(original);
  if (magnitude > MAX_FACTOR_INPUT) throw new Error("Слишком большое число.");
  return { kind: "factor", original, factors: magnitude > 1n ? factorize(magnitude) : [] };
}

function FractionView({ fraction }: { fraction: Fraction }) {
  return (
    <span className="frac" aria-label={`${fraction.numerator}/${fraction.denominator}`}>
      <span>{fmt(fraction.numerator)}</span>
      <span className="frac__rule" />
      <span>{fmt(fraction.denominator)}</span>
    </span>
  );
}

function FractionInput({
  numerator,
  denominator,
  onNumerator,
  onDenominator,
}: {
  numerator: string;
  denominator: string;
  onNumerator: (v: string) => void;
  onDenominator: (v: string) => void;
}) {
  return (
    <div className="frac-input">
      <input type="text" inputMode="numeric" aria-label="Числитель" placeholder="0" value={numerator} onChange={(e) => onNumerator(e.target.value)} />
      <span className="frac-input__line" />
      <input type="text" inputMode="numeric" aria-label="Знаменатель" placeholder="1" value={denominator} onChange={(e) => onDenominator(e.target.value)} />
    </div>
  );
}

function Result({ result }: { result: CalculationResult }) {
  if (result.kind === "gcd") {
    return (
      <div className="result-rows">
        <div className="result-row"><span>НОД</span><strong>{fmt(result.gcd)}</strong></div>
        <div className="result-row"><span>НОК</span><strong>{fmt(result.lcm)}</strong></div>
      </div>
    );
  }
  if (result.kind === "common") {
    return (
      <div className="result-fracs">
        <FractionView fraction={result.first} />
        <span className="result-and">и</span>
        <FractionView fraction={result.second} />
      </div>
    );
  }
  if (result.kind === "reduce") {
    return (
      <div className="result-fracs">
        <FractionView fraction={result.reduced} />
      </div>
    );
  }
  const magnitude = abs(result.original);
  if (magnitude <= 1n) {
    return <div className="result-text">{fmt(result.original)} не раскладывается на простые множители</div>;
  }
  return (
    <div className="result-text">
      {fmt(result.original)} = {result.original < 0n && "−"}
      {result.factors.map(([prime, power], index) => (
        <span key={prime.toString()}>
          {index > 0 && <span className="mul"> · </span>}
          {fmt(prime)}
          {power > 1 && <sup>{power}</sup>}
        </span>
      ))}
    </div>
  );
}

export default function App() {
  const [tool, setTool] = useState<ToolId>("gcd");
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState("");

  const set = (key: keyof Inputs) => (value: string) => {
    setInputs((c) => ({ ...c, [key]: value }));
    setResult(null);
    setError("");
  };

  const selectTool = (id: ToolId) => {
    setTool(id);
    setResult(null);
    setError("");
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setResult(calculate(tool, inputs));
      setError("");
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Ошибка ввода.");
    }
  };

  return (
    <main className="app">
      <nav className="tabs" aria-label="Инструменты">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" className={`tab${tool === t.id ? " tab--active" : ""}`} onClick={() => selectTool(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <form className="panel" onSubmit={submit} key={tool}>
        {tool === "gcd" && (
          <div className="row">
            <input type="text" inputMode="numeric" className="num" aria-label="Первое число" placeholder="a" value={inputs.gcdA} onChange={(e) => set("gcdA")(e.target.value)} autoFocus />
            <span className="sep">и</span>
            <input type="text" inputMode="numeric" className="num" aria-label="Второе число" placeholder="b" value={inputs.gcdB} onChange={(e) => set("gcdB")(e.target.value)} />
          </div>
        )}

        {tool === "common" && (
          <div className="row">
            <FractionInput numerator={inputs.commonN1} denominator={inputs.commonD1} onNumerator={set("commonN1")} onDenominator={set("commonD1")} />
            <span className="sep">и</span>
            <FractionInput numerator={inputs.commonN2} denominator={inputs.commonD2} onNumerator={set("commonN2")} onDenominator={set("commonD2")} />
          </div>
        )}

        {tool === "reduce" && (
          <div className="row">
            <FractionInput numerator={inputs.reduceN} denominator={inputs.reduceD} onNumerator={set("reduceN")} onDenominator={set("reduceD")} />
          </div>
        )}

        {tool === "factor" && (
          <div className="row">
            <input type="text" inputMode="numeric" className="num num--wide" aria-label="Число" placeholder="n" value={inputs.factorN} onChange={(e) => set("factorN")(e.target.value)} autoFocus />
          </div>
        )}

        <button type="submit" className="go">Посчитать</button>

        {error && <p className="error" role="alert">{error}</p>}
        {result && (
          <div className="result" aria-live="polite">
            <Result result={result} />
          </div>
        )}
      </form>
    </main>
  );
}

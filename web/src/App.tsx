import { LegacyRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoChevronForwardSharp } from "react-icons/io5";
import axios from "axios";

type History = {
	type: "input" | "error" | "result";
	value: string;
};

type Query = {
	sql: string;
	args: (string | number | boolean)[];
};

type ErrorResponse = {
	message: string;
	code: number;
};

type QueryResult = {
	data: object[];
};

type ExecResult = {
	last_inserted_id: number;
	rows_affected: number;
};

type Response = {
	data: {
		type: "query" | "exec";
		data: QueryResult[] | ExecResult;
	};
	error: ErrorResponse;
	ok: boolean;
};

const API_URL = import.meta.env.DEV ? "http://localhost:8080" : "https://lidosqe.fly.dev";

function App() {
	const terminalRef = useRef<HTMLDivElement>(null);
	const [input, setInput] = useState<string>("");
	const [history, setHistory] = useState<History[]>([]);

	useEffect(() => {
		(terminalRef.current as HTMLDivElement).scrollTop = terminalRef.current?.scrollHeight || 0;
	}, [history]);

	function getLastInput() {
		if (history.length == 0) return;
		const inputs = history.filter((item) => item.type == "input");
		return inputs[inputs.length - 1]?.value;
	}

	const memoizedGetLastInput = useCallback(getLastInput, [history]);

	if (typeof window !== "undefined") {
		addEventListener("keydown", (e) => {
			if (e.key === "ArrowUp") {
				setInput(memoizedGetLastInput() || "");
			}
		});
	}

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (input === "" || !input?.endsWith(";")) return;
		let currentSQL = input;
		setHistory((prev) => [...prev, { type: "input", value: input }]);
		setInput("");

		if (currentSQL.endsWith(";")) {
			currentSQL = currentSQL.slice(0, -1);
		}

		const parts = currentSQL?.trim()?.split("~");
		const sql = (parts?.[0] ?? "").trim();
		let args = parts?.[1]?.split(",") ?? [];
		args = args.map((arg) => arg.trim());

		const query: Query = { sql, args };
		return handleQuery(query);
	}

	function handleQuery(query: Query) {
		axios
			.post<Response>(`${API_URL}/query`, query)
			.then((res) => {
				res.data.ok
					? setHistory((prev) => [
							...prev,
							{
								type: "result",
								value: res.data.data.type == "exec" ? `${(res.data.data.data as ExecResult).rows_affected} row(s) affected` : JSON.stringify(res.data.data.data),
							},
					  ])
					: setHistory((prev) => [...prev, { type: "error", value: res.data.error.message }]);
			})
			.catch((e) => {
				if (e?.response) {
					return setHistory((prev) => [...prev, { type: "error", value: "error: " + e.response.data.error.message }]);
				}

				return setHistory((prev) => [...prev, { type: "error", value: "Something went wrong" }]);
			});
	}

	return (
		<main className="w-screen h-screen bg-black flex flex-col items-center justify-center">
			<div className="h-5/6 w-[80vw] bg-zinc-900/80 space-y-1 rounded-lg overflow-x-hidden p-6" ref={terminalRef}>
				{history.map((item, index) => (
					<HistoryLog key={index} item={item} setInput={setInput} />
				))}
				<form className="flex items-center gap-2" onSubmit={handleSubmit}>
					<IoChevronForwardSharp className="inline-block text-sm text-zinc-500" />
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						className="w-full bg-transparent text-base font-mono placeholder:text-zinc-800 focus:outline-none"
						placeholder="SELECT * FROM users WHERE id = ? AND name = ? ~ 2, John"
					/>
				</form>
			</div>
			<button className="text-red-400 hover:opacity-50 transition-all py-2 px-4" onClick={() => setHistory([])}>
				clear console
			</button>
		</main>
	);
}

function HistoryLog({ item, setInput }: { item: History; setInput: (value: string) => void }) {
	return (
		<div className="flex items-center gap-2">
			{item.type == "input" ? (
				<button onClick={() => setInput(item.value)}>
					<IoChevronForwardSharp className="inline-block text-sm text-zinc-500 hover:text-zinc-100 hover:translate-x-1 transition-all" />
				</button>
			) : null}

			<p
				className={`bg-transparent font-mono text-base ${
					item.type == "error" ? "text-red-500 font-semibold" : item.type == "result" ? "text-emerald-500 font-medium" : "text-zinc-50"
				}`}>
				{item.value}
			</p>
		</div>
	);
}

export default App;

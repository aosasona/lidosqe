import { useState } from "react";
import { IoChevronForwardSharp } from "react-icons/io5";

type History = {
	type: "input" | "error" | "result";
	value: string;
};

type Query = {
	sql: string;
	args: (string | number | boolean)[];
};

const API_URL = "http://localhost:8080";

function App() {
	const [input, setInput] = useState<string>("");
	const [history, setHistory] = useState<History[]>([]);

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (input === "") return;
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
		console.log(query);
	}

	function handleQuery() {
		return;
	}

	return (
		<main className="w-screen h-screen bg-black flex flex-col items-center justify-center">
			<div className="h-5/6 w-[80vw] bg-zinc-900/80 space-y-1 rounded-lg overflow-x-hidden p-4">
				{history.map((item, index) => (
					<HistoryLog item={item} key={index} />
				))}
				<form className="flex items-center gap-2" onSubmit={handleSubmit}>
					<IoChevronForwardSharp className="inline-block text-sm text-zinc-500" />
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						className="w-full bg-transparent text-base font-mono placeholder:text-zinc-800 focus:outline-none"
						placeholder="select * from users"
					/>
				</form>
			</div>
			<button className="text-red-400 hover:opacity-50 transition-all py-2 px-4" onClick={() => setHistory([])}>
				clear
			</button>
		</main>
	);
}

function HistoryLog({ item }: { item: History }) {
	return (
		<div className="flex items-center gap-2">
			{item.type == "input" ? <IoChevronForwardSharp className="inline-block text-sm text-zinc-500" /> : null}
			<p
				className={`font-mono text-base ${
					item.type == "error" ? "text-red-500 font-semibold" : item.type == "result" ? "text-emerald-500 font-medium" : "text-zinc-50"
				}`}>
				{item.value}
			</p>
		</div>
	);
}

export default App;

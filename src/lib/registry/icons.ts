/**
 * Brand icons for database engines and service/monolith languages, sourced from
 * `simple-icons` (data-only: each entry is `{ title, hex, path }`). Rendered by
 * `BrandIcon.svelte`. Java and C# are absent from simple-icons (trademark), so we
 * stand in with the OpenJDK and .NET marks.
 */
import {
	siPostgresql,
	siMysql,
	siMongodb,
	siRedis,
	siPython,
	siJavascript,
	siTypescript,
	siOpenjdk,
	siGo,
	siRust,
	siDotnet,
	siPhp,
	siRuby,
	siCplusplus
} from 'simple-icons';

/** The subset of a simple-icon we render: a 24×24 path plus its brand hex. */
export type BrandIcon = { title: string; hex: string; path: string };

export type EngineId = 'postgres' | 'mysql' | 'mongo' | 'redis';

export type EngineOption = { id: EngineId; label: string; icon: BrandIcon };

export const ENGINES: EngineOption[] = [
	{ id: 'postgres', label: 'PostgreSQL', icon: siPostgresql },
	{ id: 'mysql', label: 'MySQL', icon: siMysql },
	{ id: 'mongo', label: 'MongoDB', icon: siMongodb },
	{ id: 'redis', label: 'Redis', icon: siRedis }
];

export function engineIcon(id: string): BrandIcon {
	return ENGINES.find((e) => e.id === id)?.icon ?? siPostgresql;
}

export type LanguageOption = { id: string; label: string; icon: BrandIcon };

/** The 10 most common backend languages, each with a brand icon. */
export const LANGUAGES: LanguageOption[] = [
	{ id: 'python', label: 'Python', icon: siPython },
	{ id: 'javascript', label: 'JavaScript', icon: siJavascript },
	{ id: 'typescript', label: 'TypeScript', icon: siTypescript },
	{ id: 'java', label: 'Java', icon: siOpenjdk },
	{ id: 'go', label: 'Go', icon: siGo },
	{ id: 'rust', label: 'Rust', icon: siRust },
	{ id: 'csharp', label: 'C#', icon: siDotnet },
	{ id: 'php', label: 'PHP', icon: siPhp },
	{ id: 'ruby', label: 'Ruby', icon: siRuby },
	{ id: 'cpp', label: 'C++', icon: siCplusplus }
];

export function languageOption(id?: string): LanguageOption | undefined {
	return id ? LANGUAGES.find((l) => l.id === id) : undefined;
}

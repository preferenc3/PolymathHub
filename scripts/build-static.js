const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
fs.mkdirSync(output, { recursive: true });
const files = fs.readdirSync(root).filter(file => /^(index\.html|styles\.css|studio\.css|app\.js|studio\.js|account\.js|profile-avatars\.js|profile\.css|vocabulary\.js|manifest\.json|curriculum(?:-[\w-]+)?\.js|sql-(?:course|progress|university|explore|catalog)\.(?:html|css|js)|language-(?:practice|guide|lessons)\.js|language-guide\.css)$/.test(file));
for (const file of files) fs.copyFileSync(path.join(root, file), path.join(output, file));
for (const required of ["index.html", "app.js", "studio.js", "vocabulary.js", "studio.css"]) {
  if (!fs.existsSync(path.join(output, required))) throw new Error(`Missing required asset: ${required}`);
}
console.log(`Static build ready: ${files.length} assets in dist/`);

fs.copyFileSync(path.join(root, "index.html"), path.join(output, "biblioteca.html"));
fs.copyFileSync(path.join(root, "sql-course.html"), path.join(output, "index.html"));

fs.cpSync(path.join(root, "assets/icons"), path.join(output, "assets/icons"), { recursive: true });

fs.cpSync(path.join(root, "assets/audio"), path.join(output, "assets/audio"), { recursive: true });

const { execFileSync } = require("node:child_process");
const vm = require("node:vm");
const { createHash } = require("node:crypto");
const embed = (id, value) => `<script type="application/json" id="${id}">${JSON.stringify(value).replace(/</g, "\\u003c")}</script>`;

const publicCourse = JSON.parse(execFileSync("python3", ["api/sql-lab.py", "--catalog"], { cwd: root, encoding: "utf8" }));
for (const name of ["index.html", "sql-course.html"]) {
  const file = path.join(output, name);
  const html = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, html.replace('  <script src="sql-catalog.js">', `  ${embed("sql-course-data", publicCourse)}\n  <script src="sql-catalog.js">`));
}

const libraryPath = path.join(output, "biblioteca.html");
const library = fs.readFileSync(libraryPath, "utf8");
const sourceTags = /  <script src="(curriculum(?:-[\w-]+)?\.js)"><\/script>\n/g;
const sources = [...library.matchAll(sourceTags)].map(match => match[1]).filter(file => file !== "curriculum-tests.js");
const context = vm.createContext({});
for (const file of sources) vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
const lessons = vm.runInContext(`[
  ...DEFAULT_CURRICULUM, ...EXTENDED_MODULES, ...ADVANCED_CURRICULUM_EXPANSION,
  ...NEW_EXPANDED_CURRICULUM, ...CPP_EXPANDED_CURRICULUM, ...MEGA_EXPANDED_CURRICULUM,
  ...RUST_RESOURCES_CURRICULUM, ...GO_AI_SECURITY_CURRICULUM, ...FOUNDATION_CURRICULUM
]`, context);
const selected = new Map();
for (const lesson of lessons) {
  const previous = selected.get(lesson.id);
  if (!previous || ((lesson.glossary || lesson.matchingPairs) && !(previous.glossary || previous.matchingPairs))) {
    selected.set(lesson.id, lesson);
  }
}
const groups = new Map();
for (const lesson of selected.values()) {
  if (!groups.has(lesson.track)) groups.set(lesson.track, []);
  groups.get(lesson.track).push(lesson);
}
const paths = new Map();
const contentDirectory = path.join(output, "lessons");
fs.mkdirSync(contentDirectory, {recursive: true});
for (const [track, entries] of groups) {
  const body = JSON.stringify(Object.fromEntries(entries.map(lesson => [lesson.id, lesson])));
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 20);
  const filename = hash + ".json";
  fs.writeFileSync(path.join(contentDirectory, filename), body);
  paths.set(track, "/lessons/" + filename);
}
const listing = [...selected.values()].map(lesson => ({
  id: lesson.id, track: lesson.track, title: lesson.title, level: lesson.level, division: lesson.division,
  unit: lesson.unit, order: lesson.order,
  glossary: lesson.glossary?.map(({term}) => ({term})),
  contentUrl: paths.get(lesson.track)
}));
const compactLibrary = library.replace(sourceTags, (tag, file) => file === "curriculum-tests.js" ? tag : "")
  .replace('  <script src="app.js">', `  ${embed("lesson-index", listing)}\n  <script src="app.js">`)
  .replace(/^  <link [^\n]*fonts\.google[^\n]*\n/gm, "");
fs.writeFileSync(libraryPath, compactLibrary);

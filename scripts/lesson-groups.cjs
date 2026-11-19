const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourceTags = /  <script src="(curriculum(?:-[\w-]+)?\.js)"><\/script>\n/g;
function collect(root, library) {
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
  return {selected, groups};
}
function domainIndex(groups) {
  return Object.fromEntries(Array.from(groups, ([track, entries]) => [track, entries.map(entry => entry.id)]));
}
module.exports = {sourceTags, collect, domainIndex};

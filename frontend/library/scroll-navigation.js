(() => {
  const header = document.querySelector("body > .app-header, body > .top-bar");
  if (!header) return;
  const position = () => Math.max(0, Math.min(window.scrollY, document.documentElement.scrollHeight - window.innerHeight));
  let previous = position(), distance = 0;
  function reveal() {
    header.classList.remove("nav-away");
    previous = position();
    distance = 0;
  }
  window.addEventListener("scroll", () => {
    const y = position(), delta = y - previous;
    previous = y;
    if (y <= header.offsetHeight || header.matches(".menu-open, :has(:focus-visible), :has([aria-expanded=true])") || document.querySelector("dialog[open]")) {
      reveal();
      return;
    }
    if (Math.sign(delta) !== Math.sign(distance) && delta) distance = 0;
    distance += delta;
    if (distance >= 24) header.classList.add("nav-away");
    if (distance <= -6) reveal();
  }, {passive:true});
  header.addEventListener("focusin", reveal);
  window.addEventListener("hashchange", reveal);
  window.addEventListener("pageshow", reveal);
})();

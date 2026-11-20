(() => {
  const patterns = {
    rings: "Cercuri",
    grid: "Carouri",
    stripes: "Diagonale",
    dots: "Puncte",
    plain: "Simplu"
  };
  if (typeof module === "object") module.exports = patterns;
  else window.ProfilePatterns = patterns;
})();

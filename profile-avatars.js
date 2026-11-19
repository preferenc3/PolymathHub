(() => {
  const groups = {
    "Emoții": [
      ["initials", "Inițiale", ""], ["smile", "Zâmbet", "😊"], ["wink", "Cu ochiul", "😉"],
      ["cool", "Ochelari de soare", "😎"], ["curious", "Curios", "🤔"], ["starstruck", "Uimit", "🤩"],
      ["laugh", "Râs", "😄"], ["shy", "Timid", "😳"]
    ],
    "Animale": [
      ["fox", "Vulpe", "🦊"], ["owl", "Bufniță", "🦉"], ["cat", "Pisică", "🐱"],
      ["panda", "Panda", "🐼"], ["whale", "Balenă", "🐳"], ["turtle", "Țestoasă", "🐢"],
      ["dog", "Cățel", "🐶"], ["rabbit", "Iepure", "🐰"], ["frog", "Brotac", "🐸"],
      ["penguin", "Pinguin", "🐧"], ["hedgehog", "Arici", "🦔"], ["octopus", "Caracatiță", "🐙"],
      ["lion", "Leu", "🦁"], ["otter", "Vidră", "🦦"], ["butterfly", "Fluture", "🦋"]
    ],
    "Jucării": [
      ["bear", "Ursuleț", "🧸"], ["robot", "Robot", "🤖"], ["kite", "Zmeu", "🪁"],
      ["puzzle", "Puzzle", "🧩"], ["train", "Trenuleț", "🚂"], ["gamepad", "Manetă", "🎮"], ["dice", "Zar", "🎲"],
      ["balloon", "Balon", "🎈"]
    ],
    "Natură și spațiu": [
      ["sprout", "Vlăstar", "🌱"], ["sunflower", "Floarea-soarelui", "🌻"], ["volcano", "Vulcan", "🌋"],
      ["rocket", "Rachetă", "🚀"], ["planet", "Planetă", "🪐"], ["rainbow", "Curcubeu", "🌈"], ["comet", "Cometă", "☄️"]
    ],
    "Culori uni": [
      ["solid-white", "Alb", "", "solid-white"], ["solid-black", "Negru", "", "solid-black"],
      ["solid-gray", "Gri", "", "solid-gray"], ["solid-yellow", "Galben", "", "solid-yellow"],
      ["solid-violet", "Violet", "", "solid-violet"]
    ],
    "Monocrom": [
      ["mono-cat", "Pisică monocrom", "🐱", "mono"], ["mono-owl", "Bufniță monocrom", "🦉", "mono"],
      ["mono-bear", "Ursuleț monocrom", "🧸", "mono"], ["mono-robot", "Robot monocrom", "🤖", "mono"],
      ["mono-moon", "Lună monocrom", "◐", "mono"], ["mono-star", "Stea monocrom", "✦", "mono"]
    ],
    "Duoton": [
      ["duo-fox", "Vulpe în două tonuri", "🦊", "duo"], ["duo-frog", "Brotac în două tonuri", "🐸", "duo"],
      ["duo-penguin", "Pinguin în două tonuri", "🐧", "duo"], ["duo-kite", "Zmeu în două tonuri", "🪁", "duo"],
      ["duo-planet", "Planetă în două tonuri", "🪐", "duo"], ["duo-orbit", "Orbită în două tonuri", "◉", "duo"]
    ]
  };
  if (typeof module === "object") module.exports = groups;
  else window.ProfileAvatars = groups;
})();

(() => {
  const destinations = [
    {title: 'SQL', detail: 'Laboratoarele 4 și 5', href: '/sql-university.html', icon: 'code'},
    {title: 'Limbi străine', detail: 'Conversație în franceză', href: '/#cursuri?domeniu=limbi', icon: 'translate'},
    {title: 'Simulare test', detail: '5 exerciții SQL', href: '/sql-university.html?mod=test', icon: 'play'},
  ];

  function links() {
    return destinations.map(({title, detail, href, icon}) => `
      <a class="explore-destination" href="${href}">
        <span class="explore-symbol"><img src="/assets/icons/${icon}.svg" alt=""></span>
        <span><strong>${title}</strong><small>${detail}</small></span>
        <img class="explore-arrow" src="/assets/icons/caret-right.svg" alt="">
      </a>`).join('');
  }

  const button = document.getElementById('explore-button');
  const drawer = document.createElement('dialog');
  drawer.id = 'explore-drawer';
  drawer.className = 'explore-drawer';
  drawer.setAttribute('aria-labelledby', 'explore-drawer-title');
  drawer.innerHTML = `
    <header>
      <h2 id="explore-drawer-title">Experimentează</h2>
      <button class="dialog-close" type="button" aria-label="Închide meniul" autofocus>×</button>
    </header>
    <nav aria-label="Destinații Experimentează">${links()}</nav>`;
  document.body.append(drawer);
  button.addEventListener('click', () => drawer.showModal());
  drawer.addEventListener('click', event => {
    const bounds = drawer.getBoundingClientRect();
    const backdrop = event.target === drawer &&
      (event.clientX < bounds.left || event.clientX >= bounds.right ||
       event.clientY < bounds.top || event.clientY >= bounds.bottom);
    if (backdrop || event.target.closest('button, a')) drawer.close();
  });

  window.PolymathExplore = {links};
})();

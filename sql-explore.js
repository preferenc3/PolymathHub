(() => {
  const destinations = [
    {title: 'Laboratoare SQL', detail: 'Terminal, tabele și exerciții', href: '/sql-university.html', icon: 'code'},
    {title: 'Limbi străine', detail: 'Engleză, franceză și spaniolă', href: '/biblioteca.html#exploreaza?division=languages', icon: 'translate'},
    {title: 'Toate domeniile', detail: 'Catalogul de lecții', href: '/biblioteca.html#exploreaza', icon: 'book-open'},
    {title: 'Teste pe domenii', detail: '5 întrebări cu rezultat și explicații', href: '/biblioteca.html#teste', icon: 'file-text'},
    {title: 'Vocabular', detail: 'Dicționar și practică', href: '/biblioteca.html#vocabular', icon: 'translate'},
    {title: 'Simulare SQL', detail: '5 sarcini de rezolvat în terminal', href: '/sql-university.html?mod=test', icon: 'play'},
  ];

  function links(excludeHref) {
    return destinations.filter(destination => destination.href !== excludeHref).map(({title, detail, href, icon}) => `
      <a class="explore-destination" href="${href}">
        <span class="explore-symbol"><img src="/assets/icons/${icon}.svg" alt=""></span>
        <span><strong>${title}</strong><small>${detail}</small></span>
        <img class="explore-arrow" src="/assets/icons/caret-right.svg" alt="">
      </a>`).join('') + '<div data-catalog-links>' + window.PolymathCatalog.links() + '</div>';
  }

  const button = document.getElementById('explore-button');
  const drawer = document.createElement('dialog');
  drawer.id = 'explore-drawer';
  drawer.className = 'explore-drawer';
  drawer.setAttribute('aria-labelledby', 'explore-drawer-title');
  drawer.innerHTML = `
    <header>
      <h2 id="explore-drawer-title" class="dialog-heading" tabindex="-1" autofocus>Experimentează</h2>
      <button class="dialog-close" type="button" aria-label="Închide meniul">×</button>
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

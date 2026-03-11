const breakpoints = [
  { name: 'xs', minWidth: 0 },
  { name: 'sm', minWidth: 600 },
  { name: 'md', minWidth: 1024 },
  { name: 'lg', minWidth: 1440 },
  { name: 'xl', minWidth: 1920 },
];

const classes = breakpoints.map(bp => `v-screen--${bp.name}`);

const update = () =>
{
  const match = breakpoints.findLast(bp => window.innerWidth >= bp.minWidth);

  document.body.classList.remove(...classes);
  document.body.classList.add(`v-screen--${match.name}`);
};

const initScreenSize = () =>
{
  update();

  window.addEventListener('resize', update);
};

export { initScreenSize };

import '../styles/tailwind.css';

const container = document.getElementById('root');

if (container) {
  const panel = document.createElement('div');
  panel.className = 'p-4';

  const heading = document.createElement('h1');
  heading.className = 'text-[18px] font-bold';
  heading.textContent = 'Hi, Side Panel!';

  panel.appendChild(heading);
  container.replaceChildren(panel);
}

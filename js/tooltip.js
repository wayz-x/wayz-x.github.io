let popover;

function showPopover(target) {
  const title = target.dataset.popoverTitle;
  const content = target.dataset.popoverContent;

  if (!popover) {
    popover = document.createElement('div');
    popover.className = 'bs-popover';

    popover.innerHTML = `
      <div class="bs-popover-header"></div>
      <div class="bs-popover-body"></div>
      <a href="/courses/assembly.html"
                  class=" btn custom-btn bg-color bs-popover-close">
            Подробнее
      </a>
    `;

    document.body.appendChild(popover);

    popover.querySelector('.bs-popover-close')
      .addEventListener('click', hidePopover);
  }

  popover.querySelector('.bs-popover-header').textContent = title || '';
  popover.querySelector('.bs-popover-body').textContent = content || '';

  popover.classList.add('show');

  const rect = target.getBoundingClientRect();
  const box = popover.getBoundingClientRect();
  const gap = 8;

  let top = rect.bottom + gap;
  let left = rect.left + rect.width / 2 - box.width / 2;

  // если не влезает снизу — вверх
  if (top + box.height > window.innerHeight) {
    top = rect.top - box.height - gap;
  }

  // ограничения по бокам
  left = Math.max(gap, Math.min(left, window.innerWidth - box.width - gap));

  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;
}

function hidePopover() {
  popover?.classList.remove('show');
}

// desktop + mobile
document.querySelectorAll('.bs-popover-trigger').forEach(el => {
  el.addEventListener('click', e => {
    e.stopPropagation();
    showPopover(el);
  });
});

// закрытие
document.addEventListener('click', hidePopover);
window.addEventListener('scroll', hidePopover);
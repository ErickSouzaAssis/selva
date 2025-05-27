
  const btn = document.getElementById('btn-show-range-mira');
  let miraAtiva = false;

  function ativarMira() {
    document.body.classList.add('cursor-mira');
    miraAtiva = true;
  }

  function desativarMira() {
    document.body.classList.remove('cursor-mira');
    miraAtiva = false;
  }

  btn.addEventListener('click', () => {
    if (!miraAtiva) ativarMira();
  });

  // Desativa a mira ao clicar fora ou pressionar "Escape"
  document.addEventListener('click', (e) => {
    if (miraAtiva && e.target !== btn) {
      desativarMira();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && miraAtiva) {
      desativarMira();
    }
  });


import { PackagePlus } from 'lucide-react';

export function AddCardsPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRAÇÃO</p>
          <h1>Adicionar cartas</h1>
          <p className="page-description">Cadastro de cartas do simulador.</p>
        </div>
      </div>

      <section className="admin-placeholder">
        <PackagePlus size={28} aria-hidden="true" />
        <p>Em construção</p>
        <span>O cadastro de cartas será implementado em uma próxima etapa.</span>
      </section>
    </main>
  );
}

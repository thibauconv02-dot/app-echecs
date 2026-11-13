export function AboutScreen() {
  return (
    <div className="about">
      <h2>À propos</h2>
      <p>Entraîneur d’échecs personnel, entièrement local dans le navigateur.</p>
      <h3>Crédits</h3>
      <ul>
        <li>
          Pièces <strong>cburnett</strong> par Colin M.L. Burnett, via{' '}
          <a href="https://github.com/lichess-org/lila" target="_blank" rel="noreferrer">Lichess</a>, sous licence{' '}
          <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a>.
        </li>
        <li>Moteur <strong>Stockfish</strong> (stockfish.js, WebAssembly), licence GPL-3.0.</li>
        <li>Règles : chess.js ; échiquier : react-chessboard (MIT) ; stockage : Dexie.</li>
        <li>Parties importées via l’API publique de Chess.com.</li>
      </ul>
    </div>
  )
}

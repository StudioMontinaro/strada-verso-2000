// Lezioni di studio. Le mosse nei dati sono in notazione inglese (per chess.js); i testi usano quella italiana.
// Tipi di passo:
//   text     posizione (fen o moves dall'inizio) con spiegazione, frecce e case evidenziate
//   line     sequenza dimostrativa giocata mossa per mossa, con un commento per semimossa
//   find     trova la mossa (o la sequenza): solution = mosse alternate, utente e risposta
//   puzzle   puzzle dall'archivio (id Lichess)
//   practice gioca la posizione contro Stockfish fino all'obiettivo (mate | promote)
// Tutte le posizioni e le soluzioni sono state controllate con chess.js e con Stockfish 19.

export const CATS = {
  ap: { name: 'Aperture', icon: '♙', day: 3 },
  ta: { name: 'Tattica', icon: '✦', day: 2 },
  me: { name: 'Mediogioco', icon: '♜', day: 4 },
  fi: { name: 'Finali', icon: '♔', day: 1 },
};

export const LESSONS = [
  // ───────────── APERTURE ─────────────
  {
    id: 'ap1', stage: 1, cat: 'ap', title: "I tre compiti dell'apertura",
    goal: 'Centro, sviluppo, arrocco: il filtro con cui scegliere ogni mossa nelle prime dieci.',
    steps: [
      { t: 'text', moves: '', text: "In apertura hai tre compiti. Occupare o controllare il centro (le case e4, d4, e5, d5), sviluppare cavalli e alfieri, mettere il re al sicuro con l'arrocco. Sotto i 1600 moltissime partite si decidono perché uno dei tre viene trascurato.", marks: ['d4', 'e4', 'd5', 'e5'], arrows: [['e2', 'e4', 'g'], ['d2', 'd4', 'g']] },
      { t: 'line', moves: '', line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 d3 d6', notes: [
        'Il pedone occupa il centro e libera la strada ad alfiere e donna.',
        'Il Nero risponde allo stesso modo.',
        'Il cavallo si sviluppa verso il centro e attacca e5. Una mossa che sviluppa e minaccia guadagna tempo.',
        'Il Nero difende e5 sviluppando a sua volta un pezzo.',
        "L'alfiere punta su f7, la casa più debole del Nero perché all'inizio la difende solo il re.",
        'Il Nero fa lo stesso contro f2.',
        "Arrocco. Il re va al sicuro e la torre si avvicina al centro.",
        'Un altro pezzo sviluppato, con attacco a e4.',
        "Difende e4 e apre la diagonale all'alfiere di c1.",
        'Posizione equilibrata. Entrambi hanno sviluppato senza perdere tempo.',
      ] },
      { t: 'text', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 d3 d6', text: "Quattro regole pratiche. Non muovere due volte lo stesso pezzo senza un motivo concreto. Non far uscire la donna troppo presto, perché diventa un bersaglio e l'avversario si sviluppa attaccandola. Collega le torri, cioè sgombra la prima traversa. Arrocca entro le prime dieci mosse." },
      { t: 'find', moves: 'e4 e5 Nf3 Nc6', text: 'Tocca al Bianco. Sviluppa un pezzo seguendo il nostro repertorio, la Partita Italiana.', solution: 'Bc4', ok: "Giusto. L'alfiere si sviluppa sulla diagonale più attiva e mette pressione su f7." },
      { t: 'find', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Nc3 Bc5', text: 'Tocca al Bianco. Il re è ancora al centro: completa il terzo compito.', solution: 'O-O', ok: 'Esatto. Re al sicuro e torre pronta a entrare in gioco.' },
    ],
  },
  {
    id: 'ap2', stage: 1, cat: 'ap', title: 'Partita Italiana: il Giuoco Piano',
    goal: "La struttura tranquilla con c3 e d3, il piano del Bianco e la trappola di 3...Cd4.",
    steps: [
      { t: 'line', moves: '', line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3', notes: [
        '', '', '', '', '', "L'alfiere nero esce su c5, la mossa più naturale.",
        'Prepara d4 per prendere il centro e toglie la casa d4 al cavallo nero.',
        'Il Nero sviluppa e attacca e4.',
        "Difesa tranquilla di e4. Il centro si costruisce con calma, senza aprire subito il gioco: è la versione più adatta al blitz.",
        'Anche il Nero consolida e5.',
        'Arrocco.', 'Arrocco.',
        'La torre sostiene e4 e prepara la spinta d4.',
        "Il Nero crea una casa di ritirata per l'alfiere.",
        "L'alfiere si mette al riparo da ...Ca5 e resta sulla diagonale verso f7.",
        'Anche il Nero conserva il suo alfiere.',
        "Toglie la casa g4 all'alfiere nero ed evita l'inchiodatura del cavallo f3.",
      ] },
      { t: 'text', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3', text: "Il piano tipico del Bianco è la manovra Cbd2, Cf1, Cg3: il cavallo arriva vicino al re nero e sostiene un futuro attacco con Ch4 o Cf5. Quando i pezzi sono pronti si spinge d4 per aprire il centro.", arrows: [['b1', 'd2', 'y'], ['d2', 'f1', 'y'], ['f1', 'g3', 'y'], ['d3', 'd4', 'g']] },
      { t: 'text', moves: 'e4 e5 Nf3 Nc6 Bc4 Nd4', text: "Attento a questa trappola, molto frequente nel blitz. Con 3...Cd4 il Nero sembra lasciare e5 indifeso. Se prendi con 4.Cxe5? il Nero gioca 4...Dg5! e attacca insieme il cavallo e g2.", arrows: [['f3', 'e5', 'r']] },
      { t: 'find', moves: 'e4 e5 Nf3 Nc6 Bc4 Nd4', text: 'Tocca al Bianco. Qual è la risposta semplice e buona alla trappola?', solution: 'Nxd4', ok: 'Giusto. Cambi il cavallo attivo; dopo 4...exd4 il Bianco continua con O-O o c3 e ha un buon gioco.' },
      { t: 'find', moves: 'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5', text: 'Ora sei il Nero e il Bianco è caduto nella trappola. Punisci.', solution: 'Qg5 Nxf7 Qxg2 Rf1 Qxe4+ Be2 Nf3#', ok: 'Matto! Ricordati di questo schema quando giochi con il Bianco.' },
    ],
  },
  {
    id: 'ap3', stage: 1, cat: 'ap', title: 'Italiana: la Difesa dei due cavalli',
    goal: 'Che cosa fare quando il Nero risponde 3...Cf6 attaccando e4.',
    steps: [
      { t: 'line', moves: 'e4 e5 Nf3 Nc6 Bc4', line: 'Nf6 d3 Be7 O-O O-O Re1 d6 c3', notes: [
        'Il Nero attacca subito e4.',
        "Difendiamo e4 con il pedone. 4.Cg5 è più aggressivo ma porta a posizioni molto teoriche: nel blitz rende di più la linea tranquilla, che si gioca con gli stessi piani del Giuoco Piano.",
        "Sviluppo prudente del Nero.",
        'Arrocco.', 'Arrocco.',
        'La torre sostiene e4.',
        'Il Nero consolida e5.',
        "Prepariamo d4 e una casa di ritirata in c2 per l'alfiere. Siamo nella stessa struttura della lezione precedente.",
      ] },
      { t: 'text', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5', text: "Se il Nero gioca 4...Ac5 si torna esattamente al Giuoco Piano: c3, O-O, Te1, Ab3 e h3. Conoscere un solo schema di piazzamento dei pezzi ti fa risparmiare tempo sull'orologio." },
      { t: 'find', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6', text: 'Tocca al Bianco. Gioca la mossa del repertorio.', solution: 'd3', ok: 'Esatto. Difendi e4 e apri la diagonale del tuo alfiere campochiaro.' },
      { t: 'find', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Na5', text: "Tocca al Bianco. Il cavallo nero attacca l'alfiere. Prima di salvarlo, fai il controllo anti-svista: che cosa ha lasciato indifeso il cavallo spostandosi?", solution: 'Nxe5', ok: "Esatto. Il cavallo in c6 difendeva e5: andando in a5 l'ha lasciato indifeso. Anche Ab3 era una buona mossa, ma prima di difenderti guarda sempre che cosa puoi prendere." },
    ],
  },
  {
    id: 'ap4', stage: 1, cat: 'ap', title: 'Contro la Siciliana: la variante Alapin',
    goal: 'Un sistema semplice con 2.c3 che evita la teoria della Siciliana aperta.',
    steps: [
      { t: 'line', moves: 'e4 c5', line: 'c3 d5 exd5 Qxd5 d4 Nf6 Nf3 Nc6 Be2', notes: [
        'Prepara d4. Se il Nero cambia in d4, riprendiamo di pedone e abbiamo due pedoni centrali.',
        'La risposta più comune.',
        'Cambiamo.',
        'La donna nera è attiva, ma senza il cavallo in c3 non abbiamo una mossa immediata per scacciarla.',
        'Prendiamo spazio al centro.',
        'Sviluppo.', 'Sviluppo.', "Il Nero aumenta la pressione su d4.",
        "Sviluppo semplice. Seguono O-O, Ae3 e c4 o Ca3 a seconda della posizione.",
      ] },
      { t: 'line', moves: 'e4 c5', line: 'c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4', notes: [
        '', 'Il Nero attacca e4.',
        'Avanziamo guadagnando tempo sul cavallo.',
        'Il cavallo trova una buona casa centrale.',
        'Occupiamo il centro.',
        'Il Nero cambia.',
        'Sviluppiamo prima di riprendere.',
        'Il Nero attacca d4.',
        "Riprendiamo: il Bianco ha un bel centro e gioca poi Ac4 o Ae2, O-O e Cc3.",
      ] },
      { t: 'find', moves: 'e4 c5', text: 'Tocca al Bianco. Gioca la mossa del repertorio.', solution: 'c3', ok: 'Giusto. Prepariamo d4.' },
      { t: 'find', moves: 'e4 c5 c3 Nf6', text: 'Tocca al Bianco. Il cavallo attacca e4: come rispondi guadagnando tempo?', solution: 'e5', ok: 'Esatto. Il cavallo deve spostarsi e tu prepari d4.' },
    ],
  },
  {
    id: 'ap5', stage: 1, cat: 'ap', title: 'Contro Francese e Caro-Kann: la spinta e5',
    goal: 'Guadagnare spazio con e5 e difendere la catena di pedoni.',
    steps: [
      { t: 'line', moves: '', line: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3', notes: [
        '', 'Difesa Francese.', '', '',
        "Spingiamo. Guadagniamo spazio e l'alfiere nero di c8 resta chiuso dietro e6.",
        'Il Nero attacca la base della catena, il pedone d4.',
        'Sosteniamo d4 con un altro pedone.',
        'Altro attacco a d4.',
        'Lo difendiamo sviluppando.',
        'La donna attacca d4 e b2.',
        'Prepariamo b4 per guadagnare spazio sul lato di donna.',
      ] },
      { t: 'line', moves: '', line: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2', notes: [
        '', 'Difesa Caro-Kann.', '', '',
        'Stessa idea: spazio e pedoni avanzati.',
        "Qui l'alfiere nero esce prima di chiudersi con ...e6.",
        'Sviluppo.', 'Il Nero completa la sua struttura.',
        'Sviluppo sicuro. Seguono O-O, poi c3 o c4.',
      ] },
      { t: 'text', moves: 'e4 e6 d4 d5 e5', text: "In queste strutture ricorda due cose. La catena di pedoni d4-e5 va difesa dalla base: d4 è il pedone che il Nero attacca con ...c5 e ...Cc6. Il tuo spazio sul lato di re ti permette di attaccare lì con i pezzi, mentre il Nero gioca sul lato di donna.", arrows: [['d4', 'e5', 'g'], ['c7', 'c5', 'r']] },
      { t: 'find', moves: 'e4 e6 d4 d5', text: 'Tocca al Bianco. Gioca la mossa del repertorio contro la Francese.', solution: 'e5', ok: 'Giusto, variante di spinta.' },
      { t: 'find', moves: 'e4 c6 d4 d5', text: 'Tocca al Bianco. Gioca la mossa del repertorio contro la Caro-Kann.', solution: 'e5', ok: 'Esatto, stessa idea.' },
    ],
  },
  {
    id: 'ap6', stage: 1, cat: 'ap', side: 'b', title: 'Con il Nero contro 1.e4: rispondere 1...e5',
    goal: 'Le risposte contro Italiana, Spagnola e Scozzese.',
    steps: [
      { t: 'line', moves: '', line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O', notes: [
        '', 'Con il Nero rispondiamo 1...e5.', '', 'Sviluppo e difesa di e5.', 'Partita Italiana.',
        'Contro l\'Italiana usiamo la stessa struttura che conosci già con il Bianco.',
        '', 'Attacco a e4.', '', 'Consolidiamo e5.', '', 'Posizione equilibrata e conosciuta.',
      ] },
      { t: 'line', moves: 'e4 e5 Nf3 Nc6', line: 'Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O', notes: [
        "Partita Spagnola. L'alfiere attacca il difensore di e5.",
        "Chiediamo subito all'alfiere cosa vuole fare.",
        "L'alfiere si ritira e mantiene la pressione.",
        'Sviluppo con attacco a e4.',
        'Il Bianco arrocca: e4 è indirettamente difeso.',
        'Sviluppo solido (Spagnola chiusa).',
        'La torre difende e4.',
        "Scacciamo l'alfiere: prima di arroccare va sistemata la minaccia su e5.",
        '', 'Ora e5 è solido.', 'Il Bianco prepara d4.', 'Arrocco: posizione solida.',
      ] },
      { t: 'line', moves: 'e4 e5 Nf3 Nc6', line: 'd4 exd4 Nxd4 Nf6', notes: [
        'Partita Scozzese.', 'Prendiamo.', 'Il Bianco riprende.',
        'Sviluppo con attacco a e4: il Nero gioca in modo semplice e attivo.',
      ] },
      { t: 'find', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 Nxe5', text: 'Sei il Nero. Il Bianco ha cambiato in c6 e ha preso e5. Ricupera il pedone.', solution: 'Qd4 Nf3 Qxe4+', ok: 'Giusto. La donna attacca cavallo ed e4 insieme e il pedone torna indietro.' },
      { t: 'find', moves: 'e4 e5 Nf3 Nc6 Bb5', text: 'Sei il Nero contro la Spagnola. Gioca la mossa del repertorio.', solution: 'a6', ok: 'Esatto.' },
    ],
  },
  {
    id: 'ap7', stage: 1, cat: 'ap', side: 'b', title: 'Con il Nero contro 1.d4: il Gambetto di Donna Rifiutato',
    goal: 'Una difesa solida con ...d5 ed ...e6, il sistema Londra e la trappola dell\'elefante.',
    steps: [
      { t: 'line', moves: '', line: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7', notes: [
        '', 'Rispondiamo con il pedone di donna.', 'Gambetto di donna.',
        "Rifiutiamo il gambetto: d5 resta solido e l'alfiere f8 può uscire.",
        '', 'Sviluppo.', 'Il Bianco inchioda il cavallo.',
        "Togliamo l'inchiodatura.",
        '', 'Arrocco.', '',
        'Sviluppo flessibile. Più avanti ...c5 o ...c6 ed ...dxc4 liberano il gioco del Nero.',
      ] },
      { t: 'line', moves: 'd4 d5', line: 'Bf4 Nf6 e3 c5 c3 Nc6 Nd2 e6 Ngf3 Bd6', notes: [
        'Sistema Londra: molto diffuso nel blitz.', 'Sviluppo.', '',
        'Attacchiamo subito d4.', '', '', '', '', '',
        "Offriamo il cambio del forte alfiere bianco in f4.",
      ] },
      { t: 'text', moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5', text: "La trappola dell'elefante. Con ...Cbd7 sembra che il cavallo f6 sia inchiodato e che d5 cada. Se il Bianco prende 6.Cxd5?? perde un pezzo." },
      { t: 'find', moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5 Nxd5', text: 'Sei il Nero. Il Bianco ha preso in d5. Punisci.', solution: 'Nxd5 Bxd8 Bb4+ Qd2 Bxd2+ Kxd2 Kxd8', ok: "Hai vinto un pezzo. Il cavallo f6 non era davvero inchiodato: dopo Axd8 lo scacco in b4 recupera la donna." },
      { t: 'find', moves: 'd4 d5 c4', text: 'Sei il Nero. Gioca la mossa del repertorio contro il Gambetto di donna.', solution: 'e6', ok: 'Esatto.' },
    ],
  },

  // ───────────── TATTICA ─────────────
  {
    id: 'ta1', stage: 1, cat: 'ta', title: 'Il controllo anti-svista',
    goal: 'La routine da fare prima di ogni mossa per smettere di regalare pezzi.',
    steps: [
      { t: 'text', moves: '', text: "Sotto i 1600 la maggior parte delle partite si perde per un pezzo lasciato in presa o una minaccia non vista. La cura è una routine di pochi secondi, da ripetere a ogni mossa finché diventa automatica." },
      { t: 'text', moves: '', text: "Primo, dopo la mossa dell'avversario chiediti che cosa vuole fare: che cosa attacca, che cosa minaccia. Secondo, prima di giocare la tua mossa guarda scacchi, catture e minacce, nell'ordine, sia tue sia sue. Terzo, guarda la casa d'arrivo del pezzo che muovi e chiediti chi la attacca e chi la difende, e che cosa resta indifeso dietro di lui." },
      { t: 'puzzle', id: '9G4Us', text: "Applica la routine. L'avversario ha appena mosso: c'è qualcosa di indifeso?" },
      { t: 'puzzle', id: 'fRWzT' },
      { t: 'puzzle', id: 'Qsyqs' },
      { t: 'puzzle', id: 'KigHe' },
    ],
  },
  {
    id: 'ta2', stage: 1, cat: 'ta', title: 'La forchetta',
    goal: 'Un pezzo che attacca due bersagli insieme: il motivo tattico più frequente.',
    steps: [
      { t: 'text', fen: 'r3kb1r/pp3ppp/8/1N6/8/8/PP3PPP/R3KB1R w KQkq - 0 1', text: "Il cavallo è il pezzo da forchetta per eccellenza, perché attacca case che gli altri pezzi non vedono. I bersagli migliori sono re, donna e torri, o pezzi indifesi. Qui il cavallo può saltare in c7: guarda quali pezzi attaccherebbe.", arrows: [['b5', 'c7', 'g']] },
      { t: 'find', fen: 'r3kb1r/pp3ppp/8/1N6/8/8/PP3PPP/R3KB1R w KQkq - 0 1', text: 'Tocca al Bianco. Trova la forchetta.', solution: 'Nc7+', ok: 'Scacco al re e attacco alla torre a8: il Nero deve muovere il re e perde la torre.' },
      { t: 'puzzle', id: 'YIRx8' },
      { t: 'puzzle', id: '5qOhq' },
      { t: 'puzzle', id: 'TpayW' },
    ],
  },
  {
    id: 'ta3', stage: 1, cat: 'ta', title: "L'inchiodatura",
    goal: 'Un pezzo che non può muoversi senza esporre un pezzo più importante.',
    steps: [
      { t: 'text', moves: 'e4 e5 Nf3 Nc6 Bb5 d6', text: "Dopo ...d6 l'alfiere in b5 inchioda il cavallo c6 al re. L'inchiodatura è assoluta quando dietro c'è il re: il pezzo inchiodato non può muoversi per regola. È relativa quando dietro c'è un pezzo di valore: muoversi è legale ma costa materiale. Un pezzo inchiodato non difende davvero: è il momento di attaccarlo ancora.", arrows: [['b5', 'e8', 'y']] },
      { t: 'puzzle', id: 'NhCou' },
      { t: 'puzzle', id: 'z64m8' },
      { t: 'puzzle', id: '7hPOG' },
    ],
  },
  {
    id: 'ta4', stage: 1, cat: 'ta', title: "L'infilata",
    goal: "Il contrario dell'inchiodatura: si attacca il pezzo più importante e si cattura quello dietro.",
    steps: [
      { t: 'text', fen: '3q4/8/8/3k4/8/8/8/R3K3 w - - 0 1', text: "Re e donna nero sono sulla stessa colonna. Se dai scacco lungo quella colonna, il re deve spostarsi e la donna resta esposta.", arrows: [['d5', 'd8', 'r']] },
      { t: 'find', fen: '3q4/8/8/3k4/8/8/8/R3K3 w - - 0 1', text: 'Tocca al Bianco. Trova l\'infilata.', solution: 'Rd1+', ok: 'Il re deve lasciare la colonna d e la torre cattura la donna.' },
      { t: 'puzzle', id: 'KQoe1' },
      { t: 'puzzle', id: '8yu0c' },
      { t: 'puzzle', id: 'oVMW8' },
    ],
  },
  {
    id: 'ta5', stage: 1, cat: 'ta', title: 'Attacco di scoperta e scacco doppio',
    goal: 'Muovere un pezzo per liberare la linea di un altro: due minacce con una mossa.',
    steps: [
      { t: 'text', moves: '', text: "Nell'attacco di scoperta un pezzo si sposta e libera la linea di una torre, di un alfiere o della donna. Se il pezzo che si sposta minaccia qualcosa a sua volta, l'avversario deve parare due minacce con una mossa sola. Quando entrambi danno scacco si chiama scacco doppio e il re è obbligato a muoversi." },
      { t: 'puzzle', id: '0TCvv' },
      { t: 'puzzle', id: 'X8XT3' },
      { t: 'puzzle', id: 'v9NOf' },
      { t: 'puzzle', id: 'Gm6JW' },
    ],
  },
  {
    id: 'ta6', stage: 1, cat: 'ta', title: 'Matto sulla traversa ed eliminazione del difensore',
    goal: 'Il re chiuso dai propri pedoni e il pezzo che regge tutta la difesa.',
    steps: [
      { t: 'find', fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', text: 'Il re nero è chiuso dai suoi pedoni. Tocca al Bianco: dai matto.', solution: 'Re8#', ok: "Matto sulla traversa. Per evitarlo nelle tue partite, quando i pezzi pesanti sono sulla scacchiera crea per tempo una casa di fuga con h3 o g3 (h6 o g6 con il Nero)." },
      { t: 'text', moves: '', text: "Eliminare il difensore significa catturare, deviare o scacciare il pezzo che protegge qualcosa di importante. Prima di cercare la combinazione, chiediti quale pezzo avversario fa da solo un lavoro decisivo." },
      { t: 'puzzle', id: '6iRlA' },
      { t: 'puzzle', id: 'bxtkl' },
      { t: 'puzzle', id: 'fS8yW' },
      { t: 'puzzle', id: 'xWknk' },
    ],
  },

  // ───────────── FINALI ─────────────
  {
    id: 'fi1', stage: 1, cat: 'fi', title: 'Matto con donna e re',
    goal: 'La tecnica per dare matto in poche mosse senza rischiare lo stallo.',
    steps: [
      { t: 'text', fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', text: "La donna da sola non dà matto: serve il re. Il metodo è in due fasi. Prima la donna restringe il re nemico verso il bordo, stando a un salto di cavallo da lui. Poi il tuo re si avvicina e insieme date matto sul bordo." },
      { t: 'find', fen: '7k/8/6K1/8/8/8/8/5Q2 w - - 0 1', text: "Attento allo stallo. Qui Df7? sarebbe patta perché il Nero non ha mosse. Trova il matto.", solution: 'Qf8#', ok: 'Matto. Prima di ogni mossa nel finale chiediti sempre: il re avversario ha almeno una casa libera?' },
      { t: 'practice', fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', goal: 'mate', max: 20, text: 'Ora contro Stockfish: dai matto entro 20 mosse.' },
    ],
  },
  {
    id: 'fi2', stage: 1, cat: 'fi', title: 'Matto con torre e re',
    goal: 'Il metodo della scatola: la torre taglia, il re spinge.',
    steps: [
      { t: 'text', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', text: "La torre taglia al re nemico una parte della scacchiera, formando una scatola. Il tuo re si mette di fronte al re avversario, in opposizione, e la torre stringe la scatola di una riga alla volta. Quando il re nemico è sul bordo, uno scacco di torre in opposizione dà matto." },
      { t: 'find', fen: '6k1/8/6K1/8/8/8/8/R7 w - - 0 1', text: 'I re sono in opposizione. Dai matto.', solution: 'Ra8#', ok: 'Matto sulla traversa: il tuo re copre le case di fuga.' },
      { t: 'practice', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', goal: 'mate', max: 30, text: 'Ora contro Stockfish: dai matto entro 30 mosse.' },
    ],
  },
  {
    id: 'fi3', stage: 1, cat: 'fi', title: "Re e pedone contro re: l'opposizione",
    goal: 'Quando un pedone in più vince e quando è solo patta.',
    steps: [
      { t: 'text', fen: '4k3/8/8/4K3/4P3/8/8/8 w - - 0 1', text: "Nel finale di re e pedone conta il re, non il pedone. Il re deve stare davanti al pedone. Se raggiunge la sesta traversa davanti al proprio pedone, il pedone promuove sempre, tranne che sulle colonne a e h. Le case d6, e6 e f6 sono le case chiave di questo pedone.", marks: ['d6', 'e6', 'f6'] },
      { t: 'text', fen: '4k3/8/4K3/4P3/8/8/8/8 b - - 0 1', text: "Opposizione: i re sono sulla stessa colonna con una casa in mezzo, e chi deve muovere cede. Qui tocca al Nero e deve lasciare passare il re bianco." },
      { t: 'find', fen: '4k3/8/8/3K4/4P3/8/8/8 w - - 0 1', text: 'Tocca al Bianco. Porta il re su una casa chiave.', solution: 'Ke6', ok: 'Il re è sulla sesta traversa davanti al pedone: vittoria sicura.' },
      { t: 'practice', fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', goal: 'promote', max: 30, text: 'Ora contro Stockfish: promuovi il pedone. Usa il re, non spingere il pedone troppo presto.' },
    ],
  },
  {
    id: 'fi4', stage: 1, cat: 'fi', title: 'La regola del quadrato e lo sfondamento',
    goal: 'Capire in un attimo se il re arriva in tempo a fermare un pedone.',
    steps: [
      { t: 'text', fen: '7k/8/8/p7/8/8/8/5K2 w - - 0 1', text: "Disegna un quadrato dal pedone fino alla casa di promozione: qui va da a5 a e1. Se il re può entrare nel quadrato con la sua mossa, ferma il pedone. Se no, il pedone promuove.", marks: ['a5', 'b5', 'c5', 'd5', 'e5', 'e4', 'e3', 'e2', 'e1', 'a1', 'b1', 'c1', 'd1', 'a4', 'a3', 'a2'] },
      { t: 'find', fen: '7k/8/8/p7/8/8/8/5K2 w - - 0 1', text: 'Tocca al Bianco. Entra nel quadrato.', solution: 'Ke2', ok: 'Il re è nel quadrato e raggiunge il pedone in tempo.' },
      { t: 'text', fen: '8/ppp5/8/PPP5/8/8/8/k6K w - - 0 1', text: "Lo sfondamento: tre pedoni contro tre, con i re lontani. Un sacrificio apre la strada a un pedone che nessuno può più fermare." },
      { t: 'find', fen: '8/ppp5/8/PPP5/8/8/8/k6K w - - 0 1', text: 'Tocca al Bianco. Trova lo sfondamento.', solution: 'b6', ok: 'Dopo ...cxb6 segue a6! e dopo ...axb6 segue c6!: un pedone bianco promuove in ogni caso.' },
    ],
  },
  {
    id: 'fi5', stage: 1, cat: 'fi', title: 'Finali di torre: Lucena e Philidor',
    goal: 'Le due posizioni che ogni giocatore di torneo deve conoscere.',
    steps: [
      { t: 'text', fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1', text: "Posizione di Lucena. Il pedone è in settima, il tuo re davanti, il re nemico tagliato di una colonna. Si vince costruendo il ponte: la torre va in quarta traversa per poter coprire il re dagli scacchi laterali." },
      { t: 'line', fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1', line: 'Rd1+ Ke7 Rd4 Ra1 Kc7 Rc1+ Kb6 Rb1+ Kc6 Rc1+ Kb5 Rb1+ Rb4', notes: [
        'Scacco: il re nero si allontana ancora di una colonna.', '',
        'Il ponte: la torre in quarta traversa.', 'Il Nero aspetta.',
        'Il re esce da davanti al pedone.', 'Scacchi laterali.', '', '', '', '', '', '',
        'La torre si interpone: gli scacchi sono finiti e il pedone promuove.',
      ] },
      { t: 'text', fen: '4k3/8/r7/4PK2/8/8/8/4R3 b - - 0 1', text: "Posizione di Philidor, quando difendi. Il tuo re è davanti al pedone, la torre controlla la sesta traversa e impedisce al re nemico di avanzare. Quando il pedone arriva in sesta, la torre va in fondo e dà scacco da dietro: il re bianco non ha più riparo.", arrows: [['a6', 'h6', 'y']] },
      { t: 'practice', fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1', goal: 'promote', max: 25, text: 'Ora contro Stockfish: vinci la posizione di Lucena e promuovi.' },
    ],
  },

  // ───────────── MEDIOGIOCO ─────────────
  {
    id: 'me1', stage: 1, cat: 'me', title: "Sviluppo prima dell'attacco",
    goal: 'Come punire chi attacca troppo presto e come non farlo tu.',
    steps: [
      { t: 'text', orient: 'b', moves: 'e4 e5 Qh5 Nc6 Bc4', text: "Il Bianco ha fatto uscire la donna alla seconda mossa e minaccia il matto in f7. A questo livello è un attacco frequente: se lo pari bene, la donna diventa un bersaglio e tu ti sviluppi guadagnando tempo.", arrows: [['h5', 'f7', 'r'], ['c4', 'f7', 'r']] },
      { t: 'find', moves: 'e4 e5 Qh5 Nc6 Bc4', text: 'Sei il Nero. Para il matto in modo semplice.', solution: 'g6', ok: 'Giusto. Dopo 4.Df3 segue 4...Cf6: difendi e sviluppi. Anche 3...De7 va bene.' },
      { t: 'find', moves: 'e4 e5 Nf3 d5 exd5 Qxd5', text: 'Tocca al Bianco. La donna nera è al centro troppo presto: sviluppa un pezzo attaccandola.', solution: 'Nc3', ok: 'Esatto. Il Nero deve muovere di nuovo la donna e tu guadagni un tempo di sviluppo.' },
    ],
  },
  {
    id: 'me2', stage: 1, cat: 'me', title: 'Torri sulle colonne aperte',
    goal: 'Dove mettere le torri e perché.',
    steps: [
      { t: 'text', fen: 'r4rk1/pp3ppp/2n5/8/8/2N5/PP3PPP/R4RK1 w - - 0 1', text: "Una colonna è aperta quando non ci sono pedoni. La torre su una colonna aperta controlla la scacchiera fino al campo nemico e può entrare in settima traversa, dove attacca i pedoni e chiude il re. Chi occupa per primo la colonna aperta di solito ne prende il controllo.", arrows: [['d1', 'd8', 'y']] },
      { t: 'find', fen: 'r4rk1/pp3ppp/2n5/8/8/2N5/PP3PPP/R4RK1 w - - 0 1', text: 'Tocca al Bianco. Occupa la colonna aperta.', solution: ['Rad1', 'Rfd1'], ok: 'Giusto. Al prossimo passo puoi raddoppiare le torri sulla colonna d.' },
    ],
  },
  {
    id: 'me3', stage: 1, cat: 'me', title: 'Pedoni deboli e case forti',
    goal: 'Pedoni isolati e doppiati: come bloccarli e attaccarli.',
    steps: [
      { t: 'text', fen: '2r2rk1/pp2bppp/4pn2/8/3P4/2N2N2/PP3PPP/2R2RK1 b - - 0 1', text: "Il pedone d4 è isolato: nessun pedone bianco può difenderlo. La casa davanti a lui, d5, è una casa forte per il Nero, perché nessun pedone bianco può più scacciare un pezzo che ci si piazza.", marks: ['d4', 'd5'] },
      { t: 'find', fen: '2r2rk1/pp2bppp/4pn2/8/3P4/2N2N2/PP3PPP/2R2RK1 b - - 0 1', text: 'Sei il Nero. Blocca il pedone isolato con un pezzo.', solution: ['Nd5'], ok: 'Il cavallo in d5 blocca il pedone ed è inattaccabile dai pedoni. Il cavallo è il pezzo ideale per bloccare.' },
      { t: 'text', fen: '2r2rk1/pp2bppp/4pn2/8/3P4/2N2N2/PP3PPP/2R2RK1 b - - 0 1', text: "Regola pratica: prima blocca il pedone debole, poi attaccalo con più pezzi di quanti possano difenderlo, e cambia i pezzi minori quando puoi, perché nel finale il pedone isolato diventa ancora più debole." },
    ],
  },
  {
    id: 'me4', stage: 1, cat: 'me', title: 'Attacco al re: il sacrificio greco',
    goal: "Quando l'alfiere in h7 funziona, e come riconoscerlo.",
    steps: [
      { t: 'text', moves: '', text: "Il sacrificio greco è Axh7+ (o Axh2+ con il Nero) seguito da Cg5+ e dalla donna in h5. Funziona di solito se il cavallo può arrivare in g5 senza essere catturato, se la donna arriva in h5 rapidamente e se il Nero non ha un cavallo in f6 a difendere h7. Prima di sacrificare controlla queste tre condizioni." },
      { t: 'puzzle', id: 'KEdsI' },
      { t: 'puzzle', id: 'Ahkks' },
      { t: 'puzzle', id: 'RQqsO' },
    ],
  },
  {
    id: 'me5', stage: 1, cat: 'me', title: 'Quando cambiare i pezzi',
    goal: 'In vantaggio si semplifica, in attacco no.',
    steps: [
      { t: 'text', fen: '3r2k1/5ppp/8/8/8/8/5PPP/3RR1K1 w - - 0 1', text: "Con un pezzo in più, ogni cambio di pezzi rende il tuo vantaggio più grande in proporzione e riduce il controgioco. Cambia i pezzi, non i pedoni. Al contrario, se stai attaccando il re o sei in svantaggio, evita i cambi." },
      { t: 'find', fen: '3r2k1/5ppp/8/8/8/8/5PPP/3RR1K1 w - - 0 1', text: 'Tocca al Bianco, con una torre in più. Semplifica.', solution: 'Rxd8+', ok: "Dopo il cambio resta una torre contro niente: la vittoria è semplice." },
    ],
  },
];

// Programma dei livelli successivi: le lezioni vengono aggiunte quando ci arrivi.
export const SYLLABUS = {
  2: ['Finali di torre attivi: torre dietro al pedone passato', 'Combinazioni con deviazione e adescamento', 'Calcolo: mosse candidate e varianti forzate', 'Il pedone passato nel mediogioco', 'Italiana: il piano con d4 e le spinte centrali', 'Contro la Siciliana: le strutture con d4 dopo 2.c3 d5', 'Matto con alfiere e cavallo: idee base', 'La settima traversa'],
  3: ['Pezzi buoni e cattivi', 'Profilassi: che cosa vuole fare l\'avversario', 'Strutture con pedone isolato: piani per entrambi', 'Catene di pedoni e spinte di rottura', 'Gestione del tempo nel blitz', 'Finali di alfiere e di cavallo', 'Attacco con arrocchi opposti'],
  4: ['Repertorio: le varianti secondarie più frequenti nelle tue partite', 'Finali di torre complessi', 'Sacrifici posizionali', 'Conversione del vantaggio', 'Difesa delle posizioni peggiori', 'Revisione dei difetti ricorrenti emersi dalle analisi'],
};

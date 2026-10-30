// Programma settimanale delle aperture: ogni modulo è una settimana, con un'apertura da Bianco e una difesa da Nero.
// Le linee si ripetono ogni giorno della settimana; poi passano al ripasso a intervalli crescenti.
// Ogni mossa del nostro lato è stata controllata con Stockfish 19; i nomi vengono dal database aperture di Lichess.
export const MODULES = [
  {
    id: 'm1', title: 'Partita Italiana e 1...e5 contro l\'Italiana',
    white: { title: 'Partita Italiana', idea: "Alfiere in c4 contro f7, poi c3 e d3: centro solido, arrocco, Te1 e la manovra Cbd2-f1-g3 prima di spingere d4.", profile: {"storia": "L'Italiana è una delle aperture più antiche documentate: compare già nel manoscritto di Göttingen. Nel Cinquecento la svilupparono Pedro Damiano e Giulio Polerio, e nel 1620 Gioachino Greco la trattò nella sua raccolta. Il nome Giuoco Piano significa gioco tranquillo: indicava le aperture senza sacrificio di pedoni, idea sostenuta da Alessandro Salvio e dalla scuola modenese. All'inizio dell'Ottocento George Walker e William Lewis applicarono il nome alla linea con alfiere nero in c5.", "carattere": "L'alfiere in c4 punta subito su f7, la casa più delicata del Nero perché difesa soltanto dal re. L'apertura sembra tranquilla ma contiene continuazioni aggressive. La versione che impari tu è il Giuoco Pianissimo, con la spinta d3: è la linea posizionale, lenta e solida, che rinuncia a d4 in una sola mossa. Oggi c3 seguita da d3 è la linea principale moderna e resiste meglio alla preparazione dei computer rispetto alle linee tattiche con d4.", "giocatori": "L'hanno giocata Steinitz nei mondiali del 1894 e del 1896-97, Spielmann con regolarità e Karpov due volte nel mondiale del 1981. Dopo il match Kramnik-Kasparov del 2000 la difesa Berlinese ha spinto molti giocatori col Bianco verso l'Italiana, perché la evita."}, lines: [
      'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3',
      'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6 c3',
      'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 c3 d6 O-O O-O Re1 a6 Bb3',
      'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxd4 exd4 O-O',
      'e4 e5 Nf3 Nc6 Bc4 Be7 d4 d6 d5 Nb8 Bd3',
    ] },
    black: { title: '1...e5 contro l\'Italiana', idea: "Stessa struttura del Bianco: ...Ac5, ...Cf6, ...d6, arrocco. Contro d4 si cambia e si contrattacca il centro con ...d5.", profile: {"storia": "Contro l'Italiana giochi la stessa apertura antichissima vista dall'altra parte. Compare nel manoscritto di Göttingen e fu sviluppata nel Cinquecento da Damiano e Polerio, poi trattata da Greco nel 1620. Il nome Giuoco Piano, cioè gioco tranquillo, fu applicato all'inizio dell'Ottocento da George Walker e William Lewis alla linea con 3...Ac5, che è quella che giochi.", "carattere": "Con 3...Ac5 anche il tuo alfiere punta sul punto debole avversario, f2. Il piano tipico del Nero è giocare spesso ...d6, con ...a6 o ...a5, oppure arroccare per preparare la rottura ...d5. Contro la spinta d4 hai due risposte, exd4 oppure Axd4. Dopo e5 nella linea con d4 exd4, il Nero è quasi costretto a rispondere ...d5.", "giocatori": "Con il Bianco l'Italiana fu giocata da Steinitz nei mondiali del 1894 e del 1896-97 e da Karpov nel 1981: in questa linea tu stai dall'altra parte della scacchiera."}, lines: [
      'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7',
      'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 e5 d5 Bb5 Ne4 cxd4 Bb6',
      'e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 d3 d6 c3 O-O',
      'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 d6',
    ] },
  },
  {
    id: 'm2', title: 'Alapin contro la Siciliana e 1...e5 contro la Spagnola',
    white: { title: 'Siciliana, variante Alapin', idea: "Con 2.c3 prepari d4 e, dopo un cambio in d4, riprendi di pedone. Sviluppo semplice: Cf3, Ae2 o Ad3, O-O, Ae3.", profile: {"storia": "La variante Alapin prende il nome dal maestro russo Semyon Alapin, vissuto dal 1856 al 1923. Per molti anni fu poco stimata, perché si pensava che ...d5 desse al Nero una facile parità, e Tarrasch e Korn la liquidarono. Oggi è considerata una delle linee anti-Siciliana più solide e rispettabili.", "carattere": "È una scelta solida: con 2.c3 il Bianco prepara d4 per costruire un forte centro di pedoni.", "giocatori": "L'hanno giocata Anand, Kasparov, Karpov, Topalov e Kramnik. Il computer Deep Blue la usò contro Kasparov nel match del 1996, e Magnus Carlsen la giocò nello spareggio contro Praggnanandhaa alla Coppa del Mondo FIDE del 2023."}, lines: [
      'e4 c5 c3 d5 exd5 Qxd5 d4 Nf6 Nf3 Nc6 Be2',
      'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4',
      'e4 c5 c3 e6 d4 d5 exd5 exd5 Nf3 Nc6 Be2',
      'e4 c5 c3 Nc6 d4 cxd4 cxd4 d5 exd5 Qxd5 Nf3',
      'e4 c5 c3 d6 d4 Nf6 Bd3 Nc6 Nf3',
    ] },
    black: { title: '1...e5 contro la Spagnola', idea: "Contro 3.Ab5 si gioca ...a6, ...Cf6, ...Ae7, ...b5 e ...d6: e5 resta solido. Contro la variante di cambio la donna in d4 recupera il pedone.", profile: {"storia": "La Spagnola prende il nome dal sacerdote spagnolo Ruy López de Segura, che nel suo Libro del Axedrez, del 1561, la studiò in modo sistematico e giudicò Ab5 superiore ad Ac4. La mossa compare però già nel manoscritto di Göttingen, intorno al 1490. Si diffuse a metà Ottocento grazie a Carl Jaenisch e al suo articolo del dicembre 1847 sulla rivista Le Palamède.", "carattere": "L'alfiere in b5 attacca il cavallo che difende e5, prepara l'arrocco e crea una possibile inchiodatura contro il re nero. La teoria è una delle più vaste tra le aperture aperte, e per la difficoltà del Nero a ottenere la parità è detta anche Spanish Torture. Per lungo tempo è stata considerata l'apertura più importante tra quelle aperte a livello magistrale.", "giocatori": "La risposta ...a6, la difesa Morphy, è la più diffusa, circa due partite su tre: Morphy la usò contro Anderssen nel 1858, anche se non ne fu l'inventore. Chigorin affinò la linea con il cavallo in a5, e il gambetto Marshall, con ...d5, fu reso famoso da Frank Marshall nel 1918 contro Capablanca, che vinse comunque. Kramnik rese popolare la Berlinese contro Kasparov nel match del 2000."}, lines: [
      'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O',
      'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5',
      'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 Nxe5 Qd4 Nf3 Qxe4+',
      'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 d3 b5 Bb3 Be7 O-O O-O',
    ] },
  },
  {
    id: 'm3', title: 'Francese di spinta e Gambetto di Donna Rifiutato',
    white: { title: 'Francese, variante di spinta', idea: "Con 3.e5 prendi spazio e chiudi l'alfiere c8 del Nero. Difendi la base della catena, d4, con c3 e Cf3; poi a3 e b4 o lo sviluppo con Ae2 o Ad3.", profile: {"storia": "Il nome Francese nasce da una partita per corrispondenza tra Londra e Parigi, giocata nel 1834. Jacques Chamouillet convinse i giocatori parigini ad adottare questa difesa. La variante di spinta, con 3.e5, era molto giocata nei primi tempi. Aron Nimzowitsch la considerava la scelta migliore per il Bianco e ne arricchì la teoria. Nel Novecento calò di popolarità, ma negli anni Ottanta fu rilanciata da Evgeny Sveshnikov, e oggi è quasi popolare quanto 3.Cd2.", "carattere": "Con 3.e5 il Bianco prende spazio e offre un piano semplice, con possibilità d'attacco: per questo è diffusa anche tra i giocatori di club. Il Bianco forma la catena di pedoni e5-d4, sostenuta da c3, e il Nero ne attacca la base con ...c5. Il Nero ha più spazio sull'ala di donna e tende a lavorare lì, il Bianco ha spazio sull'ala di re, dove può avanzare i pedoni f e g. Il pedone e6 ostacola l'alfiere di c8, detto alfiere francese.", "giocatori": "La variante di spinta fu sostenuta da Nimzowitsch, rilanciata da Sveshnikov e giocata con successo ai massimi livelli da Alexander Grischuk."}, lines: [
      'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3',
      'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Bd7 Be2',
      'e4 e6 d4 d5 e5 c5 c3 Qb6 Nf3 Bd7 a3',
      'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Nge7 Na3',
    ] },
    black: { title: 'Gambetto di Donna Rifiutato', idea: "Con ...d5 ed ...e6 tieni il centro, sviluppi ...Cf6, ...Ae7, arrocchi e liberi il gioco più tardi con ...c5 o ...c6 e ...dxc4.", profile: {"storia": "Il Gambetto di Donna rifiutato appartiene al Gambetto di Donna, 1.d4 d5 2.c4, dove il Nero rifiuta il pedone offerto con ...e6. Divenne molto diffuso nei primi del Novecento: nel mondiale del 1927 tra Alekhine e Capablanca 32 partite su 34 iniziarono con questa apertura. La variante Cambridge Springs prende il nome dal torneo del 1904 in Pennsylvania.", "carattere": "È una delle difese più affidabili contro 1.d4. I pedoni in d5 ed e6 danno al Nero una base solida al centro. Il prezzo da pagare è l'alfiere di c8, passivo e imprigionato dal pedone e6: il Bianco cerca di sfruttarlo, il Nero cerca di liberarlo, di cambiarlo o di dimostrarne l'utilità difensiva.", "giocatori": "Emanuel Lasker giocò per primo la Cambridge Springs nel 1892. Anand usò la variante di Lasker per vincere il match mondiale contro Topalov nel 2010, e Carlsen vinse con la Cambridge Springs contro Gelfand nei Candidati del 2013."}, lines: [
      'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7',
      'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 O-O',
      'd4 d5 c4 e6 Nf3 Nf6 Bf4 Be7 e3 O-O',
      'd4 d5 c4 e6 Nc3 Nf6 Nf3 Be7 Bf4 O-O e3 c5',
    ] },
  },
  {
    id: 'm4', title: 'Caro-Kann di spinta e il Nero contro il sistema Londra',
    white: { title: 'Caro-Kann, variante di spinta', idea: "Con 3.e5 guadagni spazio. Contro ...Af5 sviluppa con Cf3 e Ae2 (variante Short), poi O-O e c3 o c4.", profile: {"storia": "La Caro-Kann prende il nome dall'inglese Horatio Caro e dall'austriaco Marcus Kann, che la analizzarono nel 1886. Kann vinse con questa difesa in 24 mosse contro Jacques Mieses ad Amburgo, nel maggio 1885. La variante di spinta, con 3.e5, fu a lungo considerata inferiore, soprattutto dopo la demolizione strategica subita da Nimzowitsch contro Capablanca a New York nel 1927. Fu rilanciata da linee aggressive, come l'attacco Bayonet con g4, la variante Tal con h4 e la linea Short.", "carattere": "La Caro-Kann è un'apertura relativamente posizionale, con struttura solida e controllo del centro. A differenza della Francese non ostacola l'alfiere di donna, ma costa un tempo, perché ...c5 richiede due mosse. Nonostante la fama di solidità offre molte varianti tattiche.", "giocatori": "La linea che studi, Cf3, Ae2 e Ae3, fu resa popolare da Nigel Short negli anni Novanta. Gli attacchi più aggressivi sono legati ai nomi di Shirov e di Mikhail Tal. Il Nero ha giocato anche ...c5, usata da Botvinnik nel match mondiale del 1961 contro Tal."}, lines: [
      'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3',
      'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 Nd7 O-O',
      'e4 c6 d4 d5 e5 c5 dxc5 e6 Nf3 Bxc5 Bd3',
      'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 Ne7 O-O',
    ] },
    black: { title: 'Contro il sistema Londra e altre d4', idea: "Attacca subito d4 con ...c5, sviluppa ...Cc6, ...e6 e offri il cambio del forte alfiere bianco con ...Ad6.", profile: {"storia": "Il Sistema Londra deve il nome al torneo di Londra del 1922, dove l'apertura comparve sette volte, anche in partite di Capablanca, Alekhine e Rubinstein. Il primo maestro a usarla regolarmente fu James Mason, a Vienna nel 1882, a Londra nel 1883 e a New York nel 1889.", "carattere": "È un sistema solido, spesso con partita chiusa, criticato per il rischio di partite ripetitive. Nel ventunesimo secolo è diventato molto popolare tra i giocatori di club per la sua solidità e i suoi piani chiari. Lo schema del Bianco è d4, Cf3, Af4, e3, Ad3, Cbd2 e c3, spesso con h3, e un piano frequente è portare il cavallo in e5.", "giocatori": "Tra i grandi la usano più spesso Kamsky, Aronian e Carlsen. Ding Liren vinse con il Sistema Londra la sesta partita del mondiale 2023 contro Nepomniachtchi. Ai livelli alti una risposta molto diffusa del Nero è ...c5 seguita da ...Db6, che attacca b2 non più difeso dall'alfiere."}, lines: [
      'd4 d5 Bf4 Nf6 e3 c5 c3 Nc6 Nd2 e6 Ngf3 Bd6',
      'd4 d5 Nf3 Nf6 Bf4 c5 e3 Nc6 c3 e6 Nbd2 Bd6',
      'd4 d5 Nf3 Nf6 e3 e6 Bd3 c5 b3 Nc6 O-O Bd6',
      'd4 d5 Nf3 Nf6 c4 e6 Nc3 Be7 Bg5 O-O',
    ] },
  },
  {
    id: 'm5', title: 'Contro Scandinava, Petrov e Philidor; il Nero contro la Scozzese',
    white: { title: 'Scandinava, Petrov e Philidor', idea: "Contro le difese meno frequenti a 1.e4: sviluppo con tempo sulla donna nella Scandinava, Cxe5 e Cf3 nella Petrov, d4 nella Philidor.", profile: {"storia": "Tre difese di epoche diverse. La Scandinava è tra le aperture più antiche documentate: compare nel poema catalano Scachs d'amor, intorno al 1475, e nel libro di Lucena del 1497. La Petrov fu resa popolare dal russo Alexander Petrov a metà Ottocento ed è chiamata anche Partita russa. La Philidor porta il nome di François-André Danican Philidor, giocatore del Settecento, che la propose come alternativa a ...Cc6, dopo cui il Bianco ha la forte Ab5.", "carattere": "La Scandinava forza subito una partita aperta: il Nero sfida il centro con ...d5 e dopo exd5 riprende con la donna, perdendo tempi. La Petrov ha fama di difesa da patta, ma offre occasioni d'attacco a entrambi: il Nero contrattacca al centro. La Philidor è solida ma passiva, scelta da chi vuole una difesa più semplice da capire.", "giocatori": "Nella Scandinava vinse due volte Capablanca a New York nel 1915, e la giocarono Anand contro Kasparov nel 1995 e Carlsen. La Petrov è stata adottata da Smyslov, Petrosian, Karpov, Kramnik e Caruana. Nella Philidor, Morphy giocò la celebre Partita all'opera nel 1858."}, lines: [
      'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4',
      'e4 d5 exd5 Nf6 d4 Nxd5 Nf3 g6 Be2',
      'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3',
      'e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6 Nc3 Be7 Be2',
    ] },
    black: { title: 'Contro Scozzese, Quattro cavalli e Viennese', idea: "Contro le aperture aperte con 1.e4 e5: sviluppa con tempo, contrattacca il pedone e4 e non cadere nelle trappole sul punto f7.", profile: {"storia": "Tre aperture aperte dell'Ottocento. La Scozzese fu citata per la prima volta da Ercole del Rio nel 1750, e il suo nome nasce da una partita per corrispondenza tra Edimburgo e Londra del 1824. La Partita dei Quattro Cavalli fu molto popolare nell'Ottocento, uscì dall'uso con la Prima guerra mondiale e rinacque negli anni Novanta. La Viennese prende il nome da Vienna, fu popolare nell'Ottocento e nasce come gambetto di re ritardato con f4: Louis Paulsen la giocò quattro volte al torneo di Vienna del 1873.", "carattere": "Nella Scozzese il Bianco scambia subito il pedone di d4 con quello di e5 per dominare il centro. I Quattro Cavalli sono spesso una partita tranquilla e posizionale, con fama di patta ma con varianti taglienti. Nella Viennese il Bianco può giocare tranquillo con Ac4 o g3, oppure sacrificare un pedone con f4.", "giocatori": "Alla fine del Novecento Kasparov rilanciò la Scozzese. Nei Quattro Cavalli giocarono la Doppia Spagnola Short, Adams e Shirov. Nella Viennese Steinitz amava il gambetto con d4, e Smyslov giocò più volte g3."}, lines: [
      'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5',
      'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7',
      'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O d3 d6',
      'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Be7',
    ] },
  },
  {
    id: 'm6', title: 'Contro Pirc e Alekhine; il Nero contro 1.c4 e 1.Cf3',
    white: { title: 'Pirc, Moderna e Alekhine', idea: "Contro le difese ipermoderne occupa il centro con i pedoni e sviluppa in modo classico: Cc3, Cf3, Ae2, O-O.", profile: {"storia": "La Pirc prende il nome dal maestro sloveno Vasja Pirc. Nel tardo Ottocento era occasionale, negli anni Sessanta divenne giocabile soprattutto grazie a Duncan Suttles, e nel 1972 comparve per la prima volta in un match mondiale, Fischer contro Spassky. L'Alekhine porta il nome di Alexander Alekhine, che la introdusse al torneo di Budapest del 1921 contro Endre Steiner e Fritz Sämisch. Una partita di Napoleone Bonaparte è uno dei primi esempi noti, e Napoleone la vinse.", "carattere": "Sono difese ipermoderne: il Nero non occupa il centro con i pedoni, ma invita il Bianco a costruirne uno grande per poi minarlo e attaccarlo dalle ali. Per questo il Bianco deve occupare il centro e sfruttare lo spazio prima che il Nero lo colpisca. Il Nero, dal canto suo, deve evitare di giocare in modo troppo passivo.", "giocatori": "Nella Pirc, Fischer preferiva l'attacco austriaco con f4, mentre Geller e Karpov usarono il sistema classico con Cf3. La partita Pirc più famosa è Kasparov-Topalov, Wijk aan Zee 1999. L'Alekhine fu giocata da Fischer contro Spassky nel 1972 e da Carlsen contro Topalov a Linares nel 2008."}, lines: [
      'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O',
      'e4 g6 d4 Bg7 Nc3 d6 Nf3 Nf6 Be2 O-O O-O',
      'e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4 Be2 e6 O-O',
      'e4 Nf6 e5 Nd5 d4 d6 Nf3 g6 Bc4 Nb6 Bb3',
    ] },
    black: { title: 'Contro 1.c4 e 1.Cf3', idea: "Rispondi con il gioco centrale: ...e5 contro l'Inglese, ...d5 e ...Cf6 contro 1.Cf3, con sviluppo rapido.", profile: {"storia": "L'Inglese prende il nome da Howard Staunton, che la giocò nel match del 1843 contro Saint-Amant e a Londra nel 1851. Non ispirò i contemporanei e si diffuse solo nel Novecento. La Réti porta il nome del cecoslovacco Richard Réti, che la introdusse al livello più alto all'inizio del 1923, con la partita di riferimento contro Rubinstein a Karlovy Vary. Nel 1924 a New York Réti batté Capablanca, allora campione del mondo.", "carattere": "Sono aperture ipermoderne: il Bianco non occupa subito il centro con i pedoni, ma lo contesta dalle ali. Réti sosteneva che il centro dovesse essere dominato dalle ali. Contro 1.c4 la risposta ...e5 porta a una Siciliana invertita, dove il Bianco ha la posizione del Nero con un tempo in più. Contro 1.Cf3 con ...d5 e poi c4 le scelte principali sono ...e6 o ...c6, vicine al Gambetto di Donna.", "giocatori": "L'Inglese è stata usata nei match mondiali da Botvinnik, Petrosian, Karpov, Kasparov, Carlsen e Ding Liren. Fischer passò a 1.c4 poco prima di ritirarsi. Gukesh giocò la Réti nell'undicesima partita del mondiale 2024 contro Ding Liren."}, lines: [
      'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6',
      'c4 e5 g3 Nf6 Bg2 d5 cxd5 Nxd5 Nc3 Nb6',
      'Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7 d3 O-O',
      'Nf3 d5 c4 e6 d4 Nf6 Nc3 Be7',
    ] },
  },
];

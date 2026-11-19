// Short guided conversations. Answer choices use Romanian so listening tests meaning.
export const languages = {
  en: {name: 'Engleză', track: 'Engleză (A1–A2)', lessons: [
    {phrase: 'Hello! My name is Anna.', translation: 'Bună! Mă numesc Anna.',
      word: 'name', meaning: 'nume', distractors: ['vârstă', 'țară'],
      grammar: 'My name ___ Anna.', answer: 'is', rule: 'Subiectul este „my name”, la singular. Folosești „is”, forma lui „to be”.',
      question: 'Ce afli despre persoana care vorbește?', choices: ['Cum o cheamă', 'De unde vine', 'Câți ani are'],
      cue: 'Accentuează „name” și prima silabă din „Anna”. Lasă vocea să coboare la finalul prezentării.'},
    {phrase: 'A glass of water, please.', translation: 'Un pahar cu apă, te rog.',
      word: 'water', meaning: 'apă', distractors: ['lapte', 'suc'],
      grammar: 'A glass ___ water, please.', answer: 'of', rule: '„A glass of” leagă recipientul de conținut. Poți folosi același model în „a cup of tea”.',
      question: 'Ce cere clientul?', choices: ['Un pahar cu apă', 'Două pahare goale', 'O ceașcă de ceai'],
      cue: 'Spune „a glass of water” într-un singur grup. Ascultă pauza scurtă înainte de „please”.'},
    {phrase: 'Excuse me, where is the station?', translation: 'Scuzați-mă, unde este gara?',
      word: 'station', meaning: 'gară', distractors: ['parc', 'piață'],
      grammar: '___ is the station?', answer: 'Where', rule: '„Where” cere un loc. „When” ar cere un moment.',
      question: 'Ce informație caută călătorul?', choices: ['Locul unde se află gara', 'Ora plecării', 'Prețul unui bilet'],
      cue: 'Fă o pauză după „Excuse me”. Ascultă prima silabă accentuată din „station”.'}
  ]},
  fr: {name: 'Franceză', track: 'Limba Franceză', lessons: [
    {phrase: 'Bonjour ! Je m’appelle Anna.', translation: 'Bună ziua! Mă numesc Anna.',
      word: 'bonjour', meaning: 'bună ziua', distractors: ['la revedere', 'mulțumesc'],
      grammar: 'Je ___ Anna.', answer: 'm’appelle', rule: '„S’appeler” este reflexiv. Cu „je” folosești „me”, care devine „m’” înainte de vocală.',
      question: 'Ce face persoana după ce salută?', choices: ['Își spune numele', 'Își ia rămas-bun', 'Întreabă cât e ora'],
      cue: 'Spune „je m’appelle” într-un singur grup. Ascultă vocala nazală din prima silabă a lui „bonjour”.'},
    {phrase: 'Un verre d’eau, s’il vous plaît.', translation: 'Un pahar cu apă, vă rog.',
      word: 'eau', meaning: 'apă', distractors: ['lapte', 'ceai'],
      grammar: 'Un verre ___, s’il vous plaît.', answer: 'd’eau', rule: 'După „un verre”, cantitatea se leagă prin „de”. Înaintea lui „eau” apare apostroful, „d’eau”.',
      question: 'Ce dorește persoana?', choices: ['Un pahar cu apă', 'O sticlă cu lapte', 'Un ceai'],
      cue: 'Grupul „eau” se aude ca o singură vocală. Ascultă modelul și leagă „d’eau” de „verre”.'},
    {phrase: 'Excusez-moi, où est la gare ?', translation: 'Scuzați-mă, unde este gara?',
      word: 'gare', meaning: 'gară', distractors: ['grădină', 'stradă'],
      grammar: 'Où est ___ gare ?', answer: 'la', rule: '„Gare” este feminin singular. Articolul hotărât corespunzător este „la”.',
      question: 'Ce vrea să găsească persoana?', choices: ['Gara', 'Un taxi', 'O stație de autobuz'],
      cue: 'Lasă o pauză după „Excusez-moi”. Ascultă cum se leagă întrebarea „où est la gare”.'}
  ]},
  es: {name: 'Spaniolă', track: 'Limba Spaniolă', lessons: [
    {phrase: '¡Hola! Me llamo Ana.', translation: 'Bună! Mă numesc Ana.',
      word: 'hola', meaning: 'salut', distractors: ['mâine', 'seară'],
      grammar: '___ llamo Ana.', answer: 'Me', rule: 'La persoana întâi, „llamarse” devine „me llamo”. Pronumele „me” face parte din această expresie.',
      question: 'Ce afli din replică?', choices: ['Cum o cheamă', 'Ce limbă studiază', 'Unde locuiește'],
      cue: 'Litera „h” din „hola” este mută. Începe direct cu vocala „o”, apoi ascultă ritmul lui „me llamo”.'},
    {phrase: 'Un vaso de agua, por favor.', translation: 'Un pahar cu apă, vă rog.',
      word: 'vaso', meaning: 'pahar', distractors: ['sticlă', 'farfurie'],
      grammar: 'Un vaso ___ agua, por favor.', answer: 'de', rule: 'Prepoziția „de” leagă recipientul de conținut. Păstrezi „de” și în „un vaso de leche”.',
      question: 'Ce comandă persoana?', choices: ['Un pahar cu apă', 'Un pahar cu suc', 'O supă'],
      cue: 'Accentuează prima silabă din „agua” și ultima din „favor”. Repetă mai întâi fiecare grup, apoi întreaga comandă.'},
    {phrase: 'Disculpe, ¿dónde está la estación?', translation: 'Scuzați-mă, unde este gara?',
      word: 'estación', meaning: 'stație sau gară', distractors: ['magazin', 'pod'],
      grammar: '¿Dónde ___ la estación?', answer: 'está', rule: 'Pentru localizarea unui loc folosești „estar”. „La estación” este la singular, așadar scrii „está”, cu accent pe „a”.',
      question: 'Ce informație dorește persoana?', choices: ['Unde este gara', 'Câte bilete mai sunt', 'Cât durează călătoria'],
      cue: 'Ascultă ultima silabă din „estación”. Semnul de accent îți arată unde cade accentul tonic.'}
  ]}
};
export const scenes = ['Te prezinți', 'Comanzi o băutură', 'Ceri indicații'];

/* Order Up! question engine.
   Loaded by order-up/index.html after the data files in order-up/data/, and by tests under node.

   HOW CONTENT IS ORGANIZED
   - A DATASET is one pool of items (songs, movies, dog breeds...) where each item is stored once with several
     attributes, plus a list of COMPARISONS that say how to rank items by one attribute. Datasets live in
     order-up/data/*.js and register themselves with OrderUpData.push({...}). See data/README.md for the format.
   - A few older topics are simple one-comparison lists (TOPICS below). They're turned into one-comparison
     datasets, so everything past this point sees one kind of thing.
   - Every (dataset, comparison) pair becomes a VIEW: the flat topic shape the game renders and scores
     (title, ask, hi/lo labels, unit, gap, and a list of {id, name, note, v} for the items that have that
     attribute). Round strings are `${viewId}|id,id,id,id,id`, so every player rebuilds the same round.

   THE QUALITY RULE for adding topics and items: a good round gives a casual player something to reason with:
   what things look like, how big they feel, when they happened, how popular they are, where they are, or plain
   common knowledge. The target feeling is "I'm not sure, but I can make an educated guess", never "there's no way
   I could know this" (five unfamiliar names) and never "this is completely obvious".
   Tools for that:
   - `fam` on dataset items: 5 extremely recognizable ... 1 obscure (unset counts as 3). Legacy topics use
     `famous` / `hard` name lists instead. A round aims for about 2 very familiar (4-5), 2 medium and at most
     1 hard (1-2) item: at least 2 and at most 4 familiar, at most 1 hard, and never five obscure names.
   - `gap`: the minimum ratio (or plain difference for `abs` / `year` comparisons) between any two items in a
     round, so values are never frustratingly close and small source differences can't flip the answer.
   - `mixed: false` keeps a topic out of the default All Topics game. It still comes up when a player
     picks its category. Use it for topics that are mostly trivia recall (waterfalls, lakes).
   - Only give an item an attribute when the value is defensible. Items without it simply sit out that comparison.
*/
(function (root) {
'use strict';

const N = 5;
// 20 per item in the right spot, so 100 for a perfect list, plus the Perfect Order bonus
const BASE_MAX = N * 20, PERFECT_BONUS = 15, ROUND_MAX = BASE_MAX + PERFECT_BONUS;
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------------- one-list topics (older format, still fine for single comparisons) ---------------- */
const FLAGS = {China:'🇨🇳', India:'🇮🇳', 'United States':'🇺🇸', Indonesia:'🇮🇩', Pakistan:'🇵🇰', Nigeria:'🇳🇬', Brazil:'🇧🇷', Bangladesh:'🇧🇩',
  Russia:'🇷🇺', Mexico:'🇲🇽', Ethiopia:'🇪🇹', Japan:'🇯🇵', Philippines:'🇵🇭', Egypt:'🇪🇬', 'DR Congo':'🇨🇩', Vietnam:'🇻🇳', Iran:'🇮🇷',
  Turkey:'🇹🇷', Germany:'🇩🇪', Thailand:'🇹🇭', 'United Kingdom':'🇬🇧', France:'🇫🇷', 'South Africa':'🇿🇦', Italy:'🇮🇹', Kenya:'🇰🇪',
  Colombia:'🇨🇴', 'South Korea':'🇰🇷', Spain:'🇪🇸', Argentina:'🇦🇷', Canada:'🇨🇦', Poland:'🇵🇱', Morocco:'🇲🇦', Peru:'🇵🇪',
  'Saudi Arabia':'🇸🇦', Australia:'🇦🇺', Chile:'🇨🇱', Netherlands:'🇳🇱', Sweden:'🇸🇪', Portugal:'🇵🇹', Greece:'🇬🇷', Israel:'🇮🇱',
  Switzerland:'🇨🇭', Norway:'🇳🇴', Ireland:'🇮🇪', 'New Zealand':'🇳🇿', Jamaica:'🇯🇲', Iceland:'🇮🇸', Kazakhstan:'🇰🇿', Algeria:'🇩🇿',
  Sudan:'🇸🇩', Libya:'🇱🇾', Mongolia:'🇲🇳', Singapore:'🇸🇬', Monaco:'🇲🇨'};

const TOPICS = [
  {id: 'lakes', title: 'Lake size', ask: 'Biggest lake to smallest', hi: 'Biggest', lo: 'Smallest', unit: 'km2', gap: 1.08, mixed: false,
   src: 'Surface area, from Wikipedia’s list of lakes by area.',
   items: [['Caspian Sea',389000,'counted as a lake'],['Lake Superior',82100],['Lake Victoria',59940],['Lake Huron',59570],['Lake Michigan',57800],
     ['Lake Tanganyika',32900],['Lake Baikal',31722],['Great Bear Lake',31153],['Lake Malawi',29600],['Great Slave Lake',27200],['Lake Erie',25667],
     ['Lake Winnipeg',24514],['Lake Ontario',19011],['Lake Ladoga',17700],['Lake Onega',9700],['Lake Titicaca',8372],['Lake Nicaragua',8264],
     ['Lake Athabasca',7850],['Reindeer Lake',6650],['Issyk-Kul',6236],['Lake Vänern',5650],['Lake of the Woods',4350],['Lake Geneva',580],
     ['Lake Tahoe',490],['Lake Garda',370],['Loch Ness',56]]},

  {id: 'islands', title: 'Island size', ask: 'Biggest island to smallest', hi: 'Biggest', lo: 'Smallest', unit: 'km2', gap: 1.08,
   src: 'Area of the island itself, from Wikipedia’s list of islands by area.',
   famous: 'Greenland|Madagascar|Great Britain|Cuba|Iceland|Ireland|Sri Lanka|Taiwan|Sicily|Jamaica|Puerto Rico|Bali|Oʻahu|Manhattan|Alcatraz',
   hard: 'Baffin Island|Sumatra|Luzon|Tenerife',
   items: [['Greenland',2108459],['New Guinea',773751],['Borneo',723154],['Madagascar',592521],['Baffin Island',507205,'Canada'],['Sumatra',428134,'Indonesia'],
     ['Honshu',228296,'Japan’s main island'],['Great Britain',218635],['South Island',150683,'New Zealand'],['Java',127467,'Indonesia'],
     ['North Island',114573,'New Zealand'],['Newfoundland',108878],['Cuba',105468,'main island'],['Luzon',104835,'Philippines'],['Iceland',100261],
     ['Ireland',83721],['Hispaniola',74366,'Haiti and the Dominican Republic'],['Sri Lanka',65916],['Tasmania',64333],['Taiwan',35808],
     ['Vancouver Island',31815],['Sicily',25498],['Sardinia',23827],['Jamaica',11037],['Hawaiʻi (Big Island)',10493],['Cyprus',9284],['Puerto Rico',8759],
     ['Corsica',8730],['Crete',8296],['Bali',5780],['Mallorca',3630],['Long Island',3505],['Tenerife',2047],['Maui',1893],['Oʻahu',1560],['Staten Island',151],
     ['Nantucket',124],['Hong Kong Island',79],['Santorini',76],['Manhattan',59],['Bora Bora',30.6],['Capri',10.4],['Alcatraz',0.09]]},

  {id: 'rivers', title: 'River length', ask: 'Longest river to shortest', hi: 'Longest', lo: 'Shortest', unit: 'km', gap: 1.12,
   src: 'Wikipedia’s list of river systems by length. River lengths vary between sources, so every river in a round is at least 12% longer than the next.',
   famous: 'Nile|Amazon|Mississippi–Missouri|Yangtze|Danube|Colorado River|Rio Grande|Ganges|Seine|Thames|Hudson River',
   hard: 'Niger|Volga|Yukon|Loire|Potomac',
   items: [['Nile',6650],['Amazon',6400],['Yangtze',6300],['Mississippi–Missouri',6275,'as one river system'],['Yellow River',5464,'China'],
     ['Congo',4700],['Mekong',4350],['Niger',4200],['Volga',3645],['Yukon',3185],['Indus',3180],['Rio Grande',3057],['Danube',2850],['Ganges',2525],
     ['Colorado River',2330],['Columbia River',2000],['Rhine',1230],['Loire',1006],['Seine',777],['Potomac',652],['Hudson River',507],['Tiber',406,'Rome'],
     ['Thames',346],['Jordan River',251]]},

  {id: 'founded', title: 'When companies started', ask: 'Oldest company to newest', hi: 'Started first', lo: 'Started last', asc: true, unit: 'year', gap: 2, year: true,
   src: 'The “Founded” year on each company’s Wikipedia page (launch year for apps and sites).',
   items: [['Johnson & Johnson',1886],['Nintendo',1889],['Coca-Cola',1892],['General Electric',1892],['Ford',1903],['Harley-Davidson',1903],
     ['IBM',1911],['BMW',1916],['Disney',1923],['LEGO',1932],['Toyota',1937],['Samsung',1938],['IKEA',1943],['Sony',1946],['Nike',1964],
     ['Intel',1968],['Starbucks',1971],['Microsoft',1975],['Apple',1976],['Oracle',1977],['Dell',1984],['Nvidia',1993],['Amazon',1994],
     ['eBay',1995],['Netflix',1997],['Google',1998],['Wikipedia',2001,'launched'],['Tesla',2003],['Facebook',2004],['YouTube',2005],['Twitter',2006],
     ['Spotify',2006],['Airbnb',2008],['Uber',2009],['WhatsApp',2009],['Instagram',2010],['Snapchat',2011],['Zoom',2011],['OpenAI',2015],['Discord',2015]]},

  {id: 'opened', title: 'When landmarks opened', ask: 'Oldest to newest', hi: 'Opened first', lo: 'Opened last', asc: true, unit: 'year', gap: 3, year: true,
   src: 'The year each landmark opened, or was finished or unveiled where noted, from Wikipedia.',
   items: [['The Colosseum',80,'finished'],['Leaning Tower of Pisa',1372,'finished'],['The White House',1800,'first lived in'],['Big Ben',1859,'finished'],['Brooklyn Bridge',1883],
     ['Statue of Liberty',1886,'unveiled'],['Washington Monument',1888],['Eiffel Tower',1889],['Tower Bridge',1894],['Panama Canal',1914],['Hollywood Sign',1923,'put up'],
     ['Chrysler Building',1930],['Empire State Building',1931],['Christ the Redeemer',1931,'unveiled'],['Sydney Harbour Bridge',1932],['Hoover Dam',1936],
     ['Golden Gate Bridge',1937],['Mount Rushmore',1941,'carving finished'],['Disneyland',1955],['Atomium',1958],['Space Needle',1962],['Gateway Arch',1965,'finished'],
     ['Sydney Opera House',1973],['CN Tower',1976],['Channel Tunnel',1994],['Petronas Towers',1999],['Burj Al Arab',1999],['London Eye',2000],
     ['Taipei 101',2004],['Burj Khalifa',2010],['Tokyo Skytree',2012],['One World Trade Center',2014]]},

  {id: 'peaks', title: 'Mountain height', ask: 'Tallest mountain to shortest', hi: 'Tallest', lo: 'Shortest', unit: 'm', gap: 1.05,
   src: 'Height above sea level, from Wikipedia.',
   famous: 'Mount Everest|K2|Kilimanjaro|Denali|Mont Blanc|Matterhorn|Mount Whitney|Mount Rainier|Mount Fuji|Mount St. Helens|Mount Olympus|Mount Vesuvius',
   hard: 'Kangchenjunga|Aconcagua|Zugspitze|Mount Kosciuszko',
   items: [['Mount Everest',8849],['K2',8611],['Kangchenjunga',8586,'third tallest'],['Aconcagua',6961,'tallest in the Americas'],['Denali',6190,'Alaska'],
     ['Kilimanjaro',5895],['Mount Elbrus',5642,'tallest in Europe'],['Mount Ararat',5137],['Mont Blanc',4806],['Matterhorn',4478],['Mount Whitney',4421],
     ['Mount Rainier',4392],['Pikes Peak',4302],['Mauna Kea',4207,'Hawaii'],['Eiger',3967],['Mount Fuji',3776],['Mount Hood',3429],['Mount Etna',3357],
     ['Zugspitze',2962,'tallest in Germany'],['Mount Olympus',2918,'Greece'],['Half Dome',2695,'Yosemite'],['Mount St. Helens',2549],['Mount Sinai',2285],
     ['Mount Kosciuszko',2228,'tallest in Australia'],['Mount Washington',1917,'New Hampshire'],['Ben Nevis',1345,'tallest in Britain'],
     ['Mount Vesuvius',1281],['Snowdon',1085,'Wales']]},

  {id: 'towers', title: 'Building height', ask: 'Tallest to shortest', hi: 'Tallest', lo: 'Shortest', unit: 'm', gap: 1.05,
   src: 'Height to the tip, from Wikipedia and the Council on Tall Buildings.',
   items: [['Burj Khalifa',828],['Merdeka 118',678.9],['Shanghai Tower',632],['Canton Tower',602],['Ping An Finance Centre',599.1],['Lotte World Tower',554.5],
     ['CN Tower',553],['One World Trade Center',541],['Ostankino Tower',540.1],['Taipei 101',508],['Shanghai World Financial Center',492],
     ['Central Park Tower',472.4],['Oriental Pearl Tower',468],['Lakhta Center',462],['Petronas Towers',451.9],['Empire State Building',443],
     ['Willis Tower',442.1],['Milad Tower',435],['432 Park Avenue',425.5],['Jin Mao Tower',420.5],['30 Hudson Yards',387.1],['Berlin TV Tower',368],
     ['Bank of China Tower',367.4],['The Strat',350.2],['Tokyo Tower',333],['Eiffel Tower',330],['Chrysler Building',319],['The Shard',309.6],
     ['Transamerica Pyramid',260],['Woolworth Building',241],['Space Needle',184],['The Gherkin',180],['Washington Monument',169],['Big Ben',96]]},

  {id: 'falls', title: 'Waterfall height', ask: 'Tallest waterfall to shortest', hi: 'Tallest', lo: 'Shortest', unit: 'm', gap: 1.08, mixed: false,
   src: 'Total drop, from Wikipedia.',
   items: [['Tugela Falls',983],['Angel Falls',979],['Vinnufossen',845],['Gocta Falls',771],['Yosemite Falls',739],['Sutherland Falls',580],
     ['Jog Falls',253],['Kaieteur Falls',226],['Multnomah Falls',189],['Bridalveil Fall',188],['Victoria Falls',108],['Iguazu Falls',82,'tallest drop'],
     ['Veliki Slap',78,'Plitvice, Croatia'],['Shoshone Falls',65],['Skógafoss',60],['Seljalandsfoss',60],['Horseshoe Falls',51,'Niagara'],
     ['Dettifoss',44],['Gullfoss',32],['Rhine Falls',23]]},

  /* ---- pop culture ---- */
  {id: 'debut', title: 'When famous characters first appeared', ask: 'First to appear to last', hi: 'Appeared first', lo: 'Appeared last', asc: true, unit: 'year', gap: 3, year: true,
   src: 'Year of each character’s first appearance in a book, comic, cartoon, film or game, from Wikipedia.',
   items: [['Sherlock Holmes',1887],['Winnie-the-Pooh',1926],['Mickey Mouse',1928],['Superman',1938],['Batman',1939],['Bugs Bunny',1940],
     ['Wonder Woman',1941],['Snoopy',1950],['James Bond',1953],['Kermit the Frog',1955],['Barbie',1959],['Spider-Man',1962],['Scooby-Doo',1969],
     ['Hello Kitty',1974],['Darth Vader',1977],['Garfield',1978],['Pac-Man',1980],['Mario',1981,'as “Jumpman” in Donkey Kong'],['Homer Simpson',1987],
     ['Sonic the Hedgehog',1991],['Buzz Lightyear',1995],['Pikachu',1996],['Harry Potter',1997],['SpongeBob',1999],['Master Chief',2001],
     ['The Minions',2010],['Elsa',2013],['Grogu',2019,'“Baby Yoda”']]},

  {id: 'celebage', title: 'Celebrity ages', ask: 'Oldest to youngest', hi: 'Oldest', lo: 'Youngest', asc: true, unit: 'born', gap: 3, year: true,
   src: 'Birth year, from each person’s Wikipedia page.',
   items: [['Morgan Freeman',1937],['Paul McCartney',1942],['Dolly Parton',1946],['Cher',1946],['Oprah Winfrey',1954],['Tom Hanks',1956],
     ['Madonna',1958],['Brad Pitt',1963],['Keanu Reeves',1964],['Jennifer Aniston',1969],['Snoop Dogg',1971],['Dwayne Johnson',1972],
     ['Leonardo DiCaprio',1974],['Pedro Pascal',1975],['Kim Kardashian',1980],['Beyoncé',1981],['Lady Gaga',1986],['Drake',1986],['Rihanna',1988],
     ['Taylor Swift',1989],['Ariana Grande',1993],['Bad Bunny',1994],['Timothée Chalamet',1995],['Zendaya',1996],['Tom Holland',1996],
     ['Sabrina Carpenter',1999],['Billie Eilish',2001],['Olivia Rodrigo',2003]]},

  {id: 'insta', title: 'Instagram followers', ask: 'Most followers to fewest', hi: 'Most followers', lo: 'Fewest followers', unit: 'mfollow', gap: 1.35, about: true,
   src: 'Approximate follower counts in 2026. They change every day, so everyone in a round has at least 1.35× the followers of the next.',
   items: [['Cristiano Ronaldo',665],['Lionel Messi',505],['Selena Gomez',420],['Dwayne Johnson',395],['Kylie Jenner',390],['Ariana Grande',375],
     ['Kim Kardashian',355],['Beyoncé',310],['Justin Bieber',295],['Taylor Swift',280],['Virat Kohli',275],['Neymar',230],['Nicki Minaj',225],
     ['Zendaya',185],['LeBron James',160],['Rihanna',150],['Drake',145],['Billie Eilish',125],['Lady Gaga',90],['Tom Holland',65],
     ['Bad Bunny',50],['Sabrina Carpenter',45]]},

  {id: 'youtube', title: 'YouTube subscribers', ask: 'Most subscribers to fewest', hi: 'Most subscribers', lo: 'Fewest subscribers', unit: 'msubs', gap: 1.4, about: true,
   src: 'Approximate subscriber counts in 2026. They change every day, so every channel in a round has at least 1.4× the subscribers of the next.',
   items: [['MrBeast',450],['T-Series',300,'Indian music label'],['Cocomelon',195],['Vlad and Niki',140],['Like Nastya',130],['PewDiePie',110],
     ['Blackpink',97],['BTS',80,'Bangtan TV'],['Mark Rober',70],['Dude Perfect',60],['Markiplier',38],['Smosh',27],['Marques Brownlee',20,'MKBHD'],
     ['Veritasium',19]]},

  {id: 'chains', title: 'Restaurant chains', ask: 'Most locations to fewest', hi: 'Most locations', lo: 'Fewest locations', unit: 'stores', gap: 1.3, about: true,
   src: 'Restaurants worldwide in 2025, from each company’s annual report or Wikipedia.',
   items: [['McDonald’s',43500],['Starbucks',40500],['Subway',37000],['KFC',31000],['Domino’s',21000],['Pizza Hut',20000],['Burger King',19700],
     ['Dunkin’',13900],['Taco Bell',8700],['Wendy’s',7300],['Tim Hortons',5900],['Popeyes',4800],['Chipotle',3700],['Chick-fil-A',3100],
     ['Panda Express',2500],['Five Guys',1900],['Shake Shack',580],['In-N-Out',420]]},

  /* ---- everyday stuff: things you can reason your way through ---- */
  {id: 'stuffcount', title: 'Everyday stuff: how many', ask: 'Most to fewest', hi: 'Most', lo: 'Fewest', unit: 'count', gap: 1.25,
   src: 'Fixed counts: calendars, official rules and standard sets.',
   items: [['Seconds in an hour',3600],['Minutes in a day',1440],['Members of the US House',435],['Days in a leap year',366],['Bones in an adult human',206],
     ['UN member countries',193],['Hours in a week',168],['Original Pokémon',151],['Keys on a full-size keyboard',104],['Tiles in Scrabble',100],
     ['Keys on a piano',88],['Squares in a Sudoku',81],['Squares on a chessboard',64],['Stickers on a Rubik’s Cube',54],['Cards in a deck',52,'no jokers'],
     ['Stars on the US flag',50],['Spaces on a Monopoly board',40],['Adult teeth',32,'with wisdom teeth'],['Dominoes in a set',28,'double-six'],
     ['Letters in the alphabet',26],['Holes on a golf course',18],['Stripes on the US flag',13],['Players per soccer team',11,'on the field'],
     ['Bowling pins',10],['Strings on a guitar',6]]},

  {id: 'stuffspeed', title: 'Everyday stuff: speed', ask: 'Fastest to slowest', hi: 'Fastest', lo: 'Slowest', unit: 'mph', gap: 1.4,
   src: 'Typical or record speeds from NASA, sports records and transit agencies. Every item in a round is at least 1.4× faster than the next.',
   items: [['Earth around the Sun',67000],['International Space Station',17500],['Speed of sound',767,'at sea level'],['Passenger jet',560,'cruising'],
     ['Bullet train',200,'Japan’s Shinkansen'],['Fastest tennis serve',163,'record'],['MLB fastball',94,'average'],['Interstate highway',70,'typical limit'],
     ['Racehorse',40,'at a gallop'],['Usain Bolt',27.8,'at top speed'],['Cyclist',12,'typical commute'],['Jogger',6],['Walking',3],['Escalator',1.1],
     ['Garden snail',0.03]]},


  {id: 'peppers', title: 'Spiciness', ask: 'Hottest to mildest', hi: 'Hottest', lo: 'Mildest', unit: 'shu', gap: 2.5,
   src: 'Scoville heat units, using the top of each pepper’s usual range. Peppers vary a lot, so every item in a round is at least 2.5× hotter than the next.',
   items: [['Pure capsaicin',16000000],['Police pepper spray',5300000],['Pepper X',2693000],['Carolina Reaper',1641000,'average'],['Ghost pepper',1000000],
     ['Habanero',350000],['Thai chili',100000],['Cayenne',50000],['Serrano',23000],['Jalapeño',8000],['Tabasco sauce',5000],['Sriracha',2200],
     ['Poblano',1500],['Frank’s RedHot',450],['Bell pepper',0]]},

  {id: 'dinos', title: 'Dinosaur length', ask: 'Longest dinosaur to shortest', hi: 'Longest', lo: 'Shortest', unit: 'm', gap: 1.4, about: true,
   src: 'Estimated length from nose to tail, from each dinosaur’s Wikipedia article. Fossil estimates vary, so every dinosaur in a round is at least 1.4× longer than the next.',
   items: [['Argentinosaurus',35],['Diplodocus',26],['Brachiosaurus',22],['Spinosaurus',15],['Tyrannosaurus rex',12.3],['Iguanodon',10],
     ['Stegosaurus',9],['Triceratops',9],['Ankylosaurus',7],['Utahraptor',6],['Pachycephalosaurus',4.5],['Deinonychus',3.4],['Velociraptor',1.8],
     ['Compsognathus',1],['Microraptor',0.8]]},

  {id: 'trees', title: 'Tall trees and plants', ask: 'Tallest to shortest', hi: 'Tallest', lo: 'Shortest', unit: 'm', gap: 1.3,
   src: 'Record or typical maximum heights, from Wikipedia and Guinness World Records.',
   items: [['Hyperion',116,'tallest known tree, a redwood'],['Centurion',100.5,'tallest eucalyptus'],['General Sherman',84,'biggest giant sequoia'],
     ['Quindío wax palm',60,'tallest palm species'],['Coconut palm',30,'fully grown'],['Baobab',25,'fully grown'],['Rockefeller Center Christmas tree',22.6,'2024'],
     ['Tallest saguaro cactus',13.8,'ever measured'],['Tallest sunflower',9.17,'world record'],['Corn stalk',2.5,'typical'],['Tulip',0.5,'typical']]},

  {id: 'planes', title: 'Airplane seats', ask: 'Most seats to fewest', hi: 'Most seats', lo: 'Fewest seats', unit: 'seats', gap: 1.25, about: true,
   src: 'Typical seats as airlines fly them, from Boeing and Airbus. Airlines vary, so every plane in a round has at least 1.25× the seats of the next.',
   items: [['Airbus A380',525],['Boeing 747',416],['Boeing 777',396],['Airbus A350',315],['Boeing 787',296],['Airbus A330',290],['Boeing 757',200],
     ['Airbus A320',165],['Boeing 737',162],['Concorde',100],['Embraer E175',78],['ATR 72',70],['Bombardier CRJ200',50],['Cessna 172',4]]},

  {id: 'ships', title: 'Ship length', ask: 'Longest ship to shortest', hi: 'Longest', lo: 'Shortest', unit: 'm', gap: 1.15,
   src: 'Overall length, from each ship’s Wikipedia page.',
   items: [['Seawise Giant',458.5,'biggest ship ever built'],['Ever Given',400,'stuck in the Suez Canal'],['Icon of the Seas',365],['Queen Mary 2',345],
     ['USS Gerald R. Ford',337,'aircraft carrier'],['Queen Mary',311],['Titanic',269],['Bismarck',251],['Lusitania',240],['USS Constitution',93],
     ['Cutty Sark',85],['HMS Victory',69],['Mayflower',30],['Santa María',18,'Columbus’s ship'],['Kon-Tiki',14,'raft']]},

  {id: 'stadiums', title: 'Stadium seats', ask: 'Most seats to fewest', hi: 'Most seats', lo: 'Fewest seats', unit: 'seats', gap: 1.15,
   src: 'Official seating capacity, from each venue’s Wikipedia page.',
   items: [['Narendra Modi Stadium',132000,'cricket, India'],['Michigan Stadium',107601],['Ohio Stadium',102780],['Melbourne Cricket Ground',100024],
     ['Wembley Stadium',90000],['Rose Bowl',89702],['Estadio Azteca',83264],['MetLife Stadium',82500],['Lambeau Field',81441],['Old Trafford',74310],
     ['SoFi Stadium',70240],['Dodger Stadium',56000],['Yankee Stadium',46537],['Wrigley Field',41649],['Fenway Park',37755],['United Center',20917,'basketball'],
     ['Madison Square Garden',19812,'basketball'],['Wimbledon Centre Court',14979]]},

  {id: 'oceans', title: 'Ocean depth', ask: 'Deepest to shallowest', hi: 'Deepest', lo: 'Shallowest', unit: 'm', gap: 1.25,
   src: 'Deepest known point, from Wikipedia.',
   items: [['Pacific Ocean',10935,'Challenger Deep'],['Atlantic Ocean',8376,'Puerto Rico Trench'],['Caribbean Sea',7686],['Southern Ocean',7432],
     ['Indian Ocean',7190],['Arctic Ocean',5550],['Mediterranean Sea',5267],['Gulf of Mexico',4384],['Sea of Japan',3742],['Red Sea',3040],
     ['Black Sea',2212],['Caspian Sea',1025],['North Sea',725],['Baltic Sea',459],['Hudson Bay',270],['Persian Gulf',90]]},

  {id: 'carbrands', title: 'When car brands started', ask: 'Oldest brand to newest', hi: 'Started first', lo: 'Started last', asc: true, unit: 'year', gap: 3, year: true,
   src: 'Founding year of each brand, from Wikipedia.',
   items: [['Cadillac',1902],['Ford',1903],['Rolls-Royce',1906],['Audi',1909],['Chevrolet',1911],['Aston Martin',1913],['BMW',1916],['Bentley',1919],
     ['Mercedes-Benz',1926],['Volvo',1927],['Porsche',1931],['Toyota',1937],['Volkswagen',1937],['Ferrari',1947,'first Ferrari car'],['Honda',1948],
     ['Lamborghini',1963],['Hyundai',1967],['Lexus',1989],['Tesla',2003],['Rivian',2009]]},

  {id: 'uscities', title: 'US city population', ask: 'Most people to fewest', hi: 'Most people', lo: 'Fewest people', unit: 'people', gap: 1.1,
   src: 'People living inside city limits, 2020 US Census.',
   items: [['New York',8804190],['Los Angeles',3898747],['Chicago',2746388],['Houston',2304580],['Phoenix',1608139],['Philadelphia',1603797],
     ['San Antonio',1434625],['San Diego',1386932],['Dallas',1304379],['San Jose',1013240],['Austin',961855],['Jacksonville',949611],['Columbus',905748],
     ['San Francisco',873965],['Seattle',737015],['Denver',715522],['Washington, DC',689545],['Nashville',689447],['Boston',675647],['Las Vegas',641903],
     ['Detroit',639111],['Baltimore',585708],['Atlanta',498715],['Miami',442241],['New Orleans',383997],['Honolulu',350964],['Orlando',307573],
     ['Pittsburgh',302971],['St. Louis',301578],['Anchorage',291247],['Salt Lake City',199723],['Burlington, VT',44743]]},

  {id: 'worldcities', title: 'World city population', ask: 'Most people to fewest', hi: 'Most people', lo: 'Fewest people', unit: 'mpop', gap: 1.3,
   src: 'UN estimates for each city’s whole urban area. Cities draw their borders differently, so every city in a round has at least 1.3× the people of the next.',
   items: [['Tokyo',37],['Delhi',33],['Shanghai',29],['São Paulo',22.6],['Mexico City',22],['Cairo',22],['Mumbai',21.3],['New York',18.9],['Lagos',15.9],
     ['Istanbul',15.8],['Buenos Aires',15.5],['Manila',14.9],['Rio de Janeiro',13.8],['Moscow',12.7],['Los Angeles',12.5],['Paris',11.3],['Bangkok',11],
     ['London',9.6],['Chicago',9],['Madrid',6.8],['Toronto',6.4],['Sydney',5.1],['Rome',4.3],['Berlin',3.6],['Dubai',3],['Dublin',1.3],['Amsterdam',1.2],
     ['Reykjavík',0.24]]},

  {id: 'parkarea', title: 'National park size', ask: 'Biggest park to smallest', hi: 'Biggest', lo: 'Smallest', unit: 'sqmi', gap: 1.2,
   src: 'Area of each US national park, from the National Park Service.',
   items: [['Wrangell–St. Elias',13175,'Alaska'],['Gates of the Arctic',11756,'Alaska'],['Denali',7408],['Death Valley',5270],['Yellowstone',3471],
     ['Everglades',2357],['Grand Canyon',1902],['Glacier',1583],['Olympic',1442],['Big Bend',1252],['Yosemite',1169],['Great Smoky Mountains',816],
     ['Sequoia',631],['Grand Teton',485],['Rocky Mountain',415],['Zion',229],['Arches',120],['Acadia',77],['Bryce Canyon',56],['Hot Springs',8.7],
     ['Gateway Arch',0.14]]},

  {id: 'parkvisits', title: 'National park visitors', ask: 'Most visitors to fewest', hi: 'Most visitors', lo: 'Fewest visitors', unit: 'mvisit', gap: 1.35,
   src: 'Visits in 2024, from the National Park Service. Every park in a round has at least 1.35× the visitors of the next.',
   items: [['Great Smoky Mountains',12.2],['Grand Canyon',4.9],['Zion',4.9],['Yellowstone',4.7],['Rocky Mountain',4.2],['Yosemite',4.1],['Acadia',4],
     ['Grand Teton',3.6],['Glacier',3.2],['Bryce Canyon',2.5],['Arches',1.5],['Death Valley',1.3],['Everglades',1.1],['Denali',0.5],
     ['Gates of the Arctic',0.011,'least visited']]},

  {id: 'airports', title: 'Busiest airports', ask: 'Most passengers to fewest', hi: 'Most passengers', lo: 'Fewest passengers', unit: 'mpass', gap: 1.15,
   src: 'Passengers in 2024, from Airports Council International.',
   items: [['Atlanta',108],['Dubai',92],['Dallas/Fort Worth',88],['Tokyo Haneda',86],['London Heathrow',84],['Denver',82],['Chicago O’Hare',80],
     ['Los Angeles',77],['Paris Charles de Gaulle',70],['Singapore Changi',68],['New York JFK',63],['Las Vegas',58],['Miami',56],['Toronto Pearson',47],
     ['Boston Logan',43],['Nashville',24.6],['Honolulu',20],['Reykjavík Keflavík',8.6]]},

  /* ---- more pop culture ---- */
  {id: 'franchises', title: 'Movie franchises', ask: 'Most money made to least', hi: 'Most money', lo: 'Least money', unit: 'musd', gap: 1.25, about: true,
   src: 'Worldwide box office for every movie in the series combined, from The Numbers. Every franchise in a round made at least 1.25× more than the next.',
   items: [['Marvel Cinematic Universe',31000],['Star Wars',10300],['Harry Potter',9600,'with Fantastic Beasts'],['James Bond',7800],['Fast & Furious',7300],
     ['Jurassic Park',6900],['Lord of the Rings',5900,'with The Hobbit'],['Despicable Me',5600,'with Minions'],['Transformers',5300],
     ['Pirates of the Caribbean',4500],['Mission: Impossible',4100],['Shrek',3800,'with Puss in Boots'],['The Hunger Games',3300],['Twilight',3300],
     ['Toy Story',3200],['Frozen',2750],['Indiana Jones',2400],['Back to the Future',960]]},

  {id: 'disney', title: 'When Disney & Pixar movies came out', ask: 'Oldest movie to newest', hi: 'Came out first', lo: 'Came out last', asc: true, unit: 'year', gap: 3, year: true,
   src: 'US release year, from each movie’s Wikipedia page.',
   items: [['Snow White',1937],['Pinocchio',1940],['Bambi',1942],['Cinderella',1950],['Peter Pan',1953],['Sleeping Beauty',1959],['101 Dalmatians',1961],
     ['The Jungle Book',1967],['The Little Mermaid',1989],['Beauty and the Beast',1991],['Aladdin',1992],['The Lion King',1994],['Toy Story',1995],
     ['Mulan',1998],['Monsters, Inc.',2001],['Finding Nemo',2003],['The Incredibles',2004],['Cars',2006],['Ratatouille',2007],['WALL-E',2008],['Up',2009],
     ['Tangled',2010],['Frozen',2013],['Big Hero 6',2014],['Zootopia',2016],['Coco',2017],['Encanto',2021],['Elemental',2023],['Inside Out 2',2024]]},

  {id: 'sitcoms', title: 'Sitcom episodes', ask: 'Most episodes to fewest', hi: 'Most episodes', lo: 'Fewest episodes', unit: 'eps', gap: 1.2,
   src: 'Episode count from each show’s Wikipedia page. Every show in a round has at least 1.2× the episodes of the next.',
   items: [['The Simpsons',790,'still airing'],['Family Guy',425,'still airing'],['The Big Bang Theory',279],['Cheers',275],['Frasier',264,'the original'],
     ['Two and a Half Men',262],['M*A*S*H',256],['Modern Family',250],['Friends',236],['Everybody Loves Raymond',210],['How I Met Your Mother',208],
     ['The Office',201,'US'],['That ’70s Show',200],['Full House',192],['Scrubs',182],['Seinfeld',180],['Brooklyn Nine-Nine',153],
     ['The Fresh Prince of Bel-Air',148],['New Girl',146],['30 Rock',138],['Parks and Recreation',126],['Community',110],['Arrested Development',84],
     ['Schitt’s Creek',80],['Veep',65],['The Good Place',53],['Ted Lasso',34],['Fawlty Towers',12]]},

  {id: 'albums', title: 'When famous albums came out', ask: 'Oldest album to newest', hi: 'Came out first', lo: 'Came out last', asc: true, unit: 'year', gap: 3, year: true,
   src: 'Original release year, from each album’s Wikipedia page.',
   items: [['Sgt. Pepper’s Lonely Hearts Club Band',1967,'The Beatles'],['Abbey Road',1969,'The Beatles'],['Led Zeppelin IV',1971],
     ['The Dark Side of the Moon',1973,'Pink Floyd'],['Rumours',1977,'Fleetwood Mac'],['Thriller',1982,'Michael Jackson'],['Purple Rain',1984,'Prince'],
     ['Appetite for Destruction',1987,'Guns N’ Roses'],['Nevermind',1991,'Nirvana'],['OK Computer',1997,'Radiohead'],
     ['The Miseducation of Lauryn Hill',1998],['The Marshall Mathers LP',2000,'Eminem'],['American Idiot',2004,'Green Day'],['21',2011,'Adele'],
     ['1989',2014,'Taylor Swift'],['Lemonade',2016,'Beyoncé'],['When We All Fall Asleep, Where Do We Go?',2019,'Billie Eilish'],['SOUR',2021,'Olivia Rodrigo'],
     ['Short n’ Sweet',2024,'Sabrina Carpenter']]},

  {id: 'artists', title: 'When artists got started', ask: 'First to start to last', hi: 'Started first', lo: 'Started last', asc: true, unit: 'year', gap: 3, year: true,
   src: 'The year each band formed, or each solo artist put out their first record, from Wikipedia.',
   items: [['Elvis Presley',1954,'first single'],['The Beatles',1960,'formed'],['The Rolling Stones',1962,'formed'],['Led Zeppelin',1968,'formed'],
     ['Queen',1970,'formed'],['ABBA',1972,'formed'],['U2',1976,'formed'],['Metallica',1981,'formed'],['Madonna',1982,'first single'],['Guns N’ Roses',1985,'formed'],
     ['Green Day',1987,'formed'],['Destiny’s Child',1990,'formed'],['Backstreet Boys',1993,'formed'],['Linkin Park',1996,'formed'],['Arctic Monkeys',2002,'formed'],
     ['Taylor Swift',2006,'first single'],['Lady Gaga',2008,'first single'],['One Direction',2010,'formed'],['BTS',2013,'debut'],['Billie Eilish',2015,'first single'],
     ['Olivia Rodrigo',2021,'first single']]},

  {id: 'techyear', title: 'When gadgets came out', ask: 'Oldest to newest', hi: 'Came out first', lo: 'Came out last', asc: true, unit: 'year', gap: 3, year: true,
   src: 'Launch year, from each product’s Wikipedia page.',
   items: [['Polaroid camera',1948],['Transistor radio',1954],['Atari 2600',1977],['Sony Walkman',1979],['IBM PC',1981],['Apple Macintosh',1984],
     ['Game Boy',1989],['Tamagotchi',1996],['Nokia 3310',2000],['iPod',2001],['Wii',2006],['iPhone',2007],['Kindle',2007],['iPad',2010],['Amazon Echo',2014],
     ['Apple Watch',2015],['AirPods',2016],['Nintendo Switch',2017],['ChatGPT',2022],['Apple Vision Pro',2024]]},

  {id: 'disneybox', title: 'Disney & Pixar box office', ask: 'Most money made to least', hi: 'Most money', lo: 'Least money', unit: 'musd', gap: 1.2,
   src: 'Worldwide gross including re-releases, from Box Office Mojo. Animated films only. Not adjusted for inflation.',
   items: [['Inside Out 2',1699],['Frozen II',1453],['Frozen',1306],['Incredibles 2',1243],['Toy Story 4',1073],['Toy Story 3',1067],['Moana 2',1059],
     ['Finding Dory',1029],['Zootopia',1025],['The Lion King',968,'1994'],['Finding Nemo',941],['Inside Out',858],['Coco',814],['Monsters University',743],
     ['Up',735],['Moana',687],['Big Hero 6',658],['The Incredibles',631],['Ratatouille',624],['Tangled',592],['Monsters, Inc.',579],['WALL-E',521],
     ['Aladdin',504,'1992'],['Elemental',496],['Cars',462],['Encanto',256],['Lightyear',227],['Onward',142]]},

  {id: 'iphones', title: 'When iPhones came out', ask: 'Oldest to newest', hi: 'Came out first', lo: 'Came out last', asc: true, unit: 'year', gap: 2, year: true,
   src: 'Launch year, from Apple’s announcements.',
   items: [['iPhone',2007,'the original'],['iPhone 3G',2008],['iPhone 3GS',2009],['iPhone 4',2010],['iPhone 4S',2011],['iPhone 5',2012],['iPhone 5s',2013],
     ['iPhone 6',2014],['iPhone 6s',2015],['iPhone 7',2016],['iPhone X',2017],['iPhone XR',2018],['iPhone 11',2019],['iPhone 12',2020],['iPhone 13',2021],
     ['iPhone 14',2022],['iPhone 15',2023],['iPhone 16',2024],['iPhone 17',2025]]},

  /* ---- sports ---- */
  {id: 'sportsballs', title: 'Sports balls: weight', ask: 'Heaviest ball to lightest', hi: 'Heaviest', lo: 'Lightest', unit: 'kg', gap: 1.35,
   src: 'Official weights from each sport’s rulebook, using the middle of the allowed range. Every ball in a round is at least 1.35× heavier than the next.',
   items: [['Bowling ball',7.26,'the heaviest allowed'],['Basketball',0.62],['Rugby ball',0.44],['Soccer ball',0.43],['American football',0.41],
     ['Volleyball',0.27],['Softball',0.19],['Hockey puck',0.17],['Cricket ball',0.16],['Baseball',0.145],['Tennis ball',0.058],['Golf ball',0.046],
     ['Squash ball',0.024],['Ping-pong ball',0.0027]]},

  {id: 'sportslen', title: 'Sports: how long', ask: 'Longest to shortest', hi: 'Longest', lo: 'Shortest', unit: 'ftin', gap: 1.25,
   src: 'Official measurements from each league’s or sport’s rulebook.',
   items: [['American football field',109.7,'including end zones'],['NHL rink',60.96],['Olympic swimming pool',50],['NBA court',28.65],
     ['Baseball base path',27.43,'home to first'],['Tennis court',23.77],['Cricket pitch',20.12],['Pitcher’s mound to home plate',18.44],
     ['Bowling lane',18.29,'foul line to head pin'],['Badminton court',13.4],['Soccer goal',7.32,'post to post'],['NBA three-point line',7.24,'at the top of the arc'],
     ['NBA free-throw line',4.57,'from the backboard'],['Hockey goal',1.83,'post to post'],['Ping-pong table',2.74],['Golf hole',0.108,'across']]},

  {id: 'sportspeed', title: 'Sports: fastest ever', ask: 'Fastest to slowest', hi: 'Fastest', lo: 'Slowest', unit: 'mph', gap: 1.35,
   src: 'Fastest recorded speeds from Guinness World Records and each sport’s governing body. Every item in a round is at least 1.35× faster than the next.',
   items: [['Badminton smash',351],['Formula 1 car',231],['Jai alai ball',188],['Tennis serve',163],['Hockey slapshot',108.8],['Baseball pitch',105.8],
     ['Cricket bowl',100.2],['Speed skater',37,'500 m race'],['Usain Bolt',27.8,'at top speed'],['Tour de France pack',26,'average for the race'],
     ['Marathon world record',13.1,'average pace'],['Olympic swimmer',5.4,'50 m freestyle']]},

  /* ---- technology ---- */
  {id: 'apps', title: 'When websites & apps launched', ask: 'Oldest to newest', hi: 'Launched first', lo: 'Launched last', asc: true, unit: 'year', gap: 2, year: true,
   src: 'Public launch year, from each service’s Wikipedia page.',
   items: [['Amazon',1995,'as an online bookstore'],['Google',1998],['Wikipedia',2001],['iTunes Store',2003],['Facebook',2004],['Gmail',2004],['YouTube',2005],
     ['Google Maps',2005],['Twitter',2006],['Netflix streaming',2007],['App Store',2008],['Spotify',2008],['WhatsApp',2009],['Instagram',2010],['Snapchat',2011],
     ['Twitch',2011],['Tinder',2012],['Zoom',2013],['Discord',2015],['TikTok',2017,'outside China'],['ChatGPT',2022],['Threads',2023]]},
];

/* ---------------- datasets -> views ---------------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const asOfLabel = d => { const [y, m] = String(d).split('-'); return m ? `${MONTHS[+m - 1]} ${y}` : y; };

// an older one-list topic becomes a dataset with a single comparison
function fromTopic(t) {
  const {id, title, items, famous, hard, mixed, flags, ...cmp} = t;
  const f = famous ? new Set(famous.split('|')) : null, h = new Set((hard || '').split('|'));
  return {id, label: title, legacy: true, mixed, flags,
    comparisons: [{...cmp, key: 'v', title}],
    items: items.map(([name, v, note]) => ({name, note, v, fam: f ? (f.has(name) ? 5 : h.has(name) ? 2 : 3) : undefined}))};
}

const SETS = {}, VIEWS = {};
function addSet(ds) {
  if (SETS[ds.id]) throw new Error(`duplicate dataset ${ds.id}`);
  SETS[ds.id] = ds;
  ds.views = [];
  const items = ds.items.map(it => ({...it, id: it.id || slug(it.name)}));
  const seen = new Set();
  for (const it of items) { if (seen.has(it.id)) throw new Error(`duplicate item ${ds.id}/${it.id}`); seen.add(it.id); }
  const hasFam = items.some(it => it.fam != null);
  for (const c of ds.comparisons) {
    const id = ds.legacy ? ds.id : `${ds.id}.${c.key}`;
    // an item takes part in a comparison only when it has a real value for it
    const list = items.filter(it => typeof it[c.key] === 'number' && isFinite(it[c.key])).map(it => ({
      id: it.id, name: it.name, v: it[c.key],
      note: (it.notes && it.notes[c.key]) || it.note || '',
      emo: ds.flags ? (FLAGS[it.name] || '') : '',
      tier: it.fam == null ? 1 : it.fam >= 4 ? 0 : it.fam <= 2 ? 2 : 1,
    }));
    const src = [c.src || ds.src, c.asOf ? `Snapshot as of ${asOfLabel(c.asOf)}.` : ''].filter(Boolean).join(' ');
    const view = {
      id, set: ds, key: c.key, title: c.title || `${ds.label} by ${c.label}`, ask: c.ask, hi: c.hi, lo: c.lo,
      unit: c.unit, gap: c.gap, year: !!c.year, abs: !!c.abs, asc: c.dir === 'asc' || !!c.asc, about: !!c.about,
      flags: !!ds.flags, src, famous: hasFam, mixed: ds.mixed, list, byId: Object.fromEntries(list.map(i => [i.id, i])),
    };
    VIEWS[id] = view;
    ds.views.push(view);
  }
}
for (const t of TOPICS) addSet(fromTopic(t));
for (const ds of root.OrderUpData || []) addSet(ds);

/* broad categories players can pick from, each listing its datasets. A new dataset just goes in one list here. */
const CATEGORIES = [
  {id: 'geo', name: 'Geography', sets: 'countries states uscities worldcities parkarea'},
  {id: 'nature', name: 'Science & Nature', sets: 'peaks falls oceans lakes rivers islands trees'},
  {id: 'animals', name: 'Animals', sets: 'animals dogs dinos'},
  {id: 'screen', name: 'Movies & TV', sets: 'movies tv franchises disney disneybox sitcoms'},
  {id: 'gaming', name: 'Gaming', sets: 'games consoles pokemon'},
  {id: 'music', name: 'Music', sets: 'songs albums artists'},
  {id: 'food', name: 'Food & Drink', sets: 'food drinks peppers chains'},
  {id: 'sports', name: 'Sports', sets: 'stadiums sportsballs sportslen sportspeed'},
  {id: 'cars', name: 'Cars & Transportation', sets: 'cars carbrands planes ships'},
  {id: 'tech', name: 'Technology', sets: 'techyear iphones apps founded'},
  {id: 'fun', name: 'Entertainment & Travel', sets: 'coasters airports parkvisits opened towers debut celebage insta youtube'},
  {id: 'stuff', name: 'Everyday Stuff', sets: 'stuff stuffcount stuffspeed'},
];
// All Topics: each game mixes about a third of each kind
const MIX = {
  know: 'countries states uscities worldcities parkarea peaks falls oceans lakes rivers islands opened towers airports parkvisits carbrands stadiums sportspeed founded',
  guess: 'animals dogs dinos trees food drinks peppers cars planes ships coasters stuff stuffcount stuffspeed sportsballs sportslen',
  pop: 'songs albums artists movies tv franchises disney disneybox sitcoms games consoles pokemon debut celebage insta youtube chains techyear iphones apps',
};
const CAT = {};
for (const c of CATEGORIES) {
  CAT[c.id] = c;
  c.list = c.sets.split(' ').map(id => { if (!SETS[id]) throw new Error(`unknown dataset ${id} in ${c.id}`); return SETS[id]; });
  for (const ds of c.list) { ds.cat = c; for (const v of ds.views) v.cat = c; }
}
// null means every category; otherwise a list of category ids (possibly empty while someone is choosing)
const cleanCats = v => Array.isArray(v) ? CATEGORIES.map(c => c.id).filter(id => v.includes(id)) : null;
const catsLabel = cats => !cats ? 'All topics' : cats.length ? cats.map(id => CAT[id].name).join(' · ') : 'None yet';

/* numbers are stored in metric (as the sources give them) and shown in US units */
function sig(x, n = 3) {
  if (!x) return 0;
  const p = Math.pow(10, n - 1 - Math.floor(Math.log10(Math.abs(x))));
  return Math.round(x * p) / p;
}
const num = x => sig(x).toLocaleString('en-US', {maximumFractionDigits: 6});
function big(x, unit) {
  if (x >= 1e9) return `${sig(x / 1e9)} billion ${unit}`;
  if (x >= 1e6) return `${sig(x / 1e6)} million ${unit}`;
  return `${num(x)} ${unit}`;
}
const KM2_PER_SQMI = 2.589988, MI_PER_KM = 0.621371;
function fmtVal(t, v) {
  switch (t.unit) {
    case 'people': return big(v, 'people');
    case 'km2': return big(v / KM2_PER_SQMI, 'sq mi');
    case 'sqmi': return `${v < 100 ? num(v) : Math.round(v).toLocaleString('en-US')} sq mi`;
    case 'km': return `${num(v * MI_PER_KM)} mi`;
    case 'kg': { const lb = v * 2.20462; return (t.about ? 'about ' : '') + (lb < 1 ? `${num(lb * 16)} oz` : big(lb, 'lb')); }
    case 'kmh': return `${num(v * MI_PER_KM)} mph`;
    case 'm': return `${Math.round(v * 3.28084).toLocaleString('en-US')} ft`;
    case 'year': return v < 1000 ? `AD ${v}` : String(v);
    case 'born': return `born ${v}`;
    case 'ftin': {
      const inch = v * 39.3701;
      if (inch < 12) return `${num(inch)} in`;
      if (inch >= 1200) return `${Math.round(inch / 12).toLocaleString('en-US')} ft`;
      let ft = Math.floor(inch / 12), i = Math.round(inch - ft * 12);
      if (i === 12) { ft++; i = 0; }
      return i ? `${ft} ft ${i} in` : `${ft} ft`;
    }
    case 'ft': return `${Math.round(v).toLocaleString('en-US')} ft`;
    case 'mph': return `${num(v)} mph`;
    case 'kcal': return `${t.about ? 'about ' : ''}${v.toLocaleString('en-US')} calories`;
    case 'mg': return `${v} mg`;
    case 'shu': return big(v, 'Scoville units');
    case 'yrs': { const d = v * 365; return 'about ' + (v >= 1 ? `${num(v)} years` : d >= 14 ? `${Math.round(d / 7)} weeks` : `${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`); }
    case 'hp': return `${v.toLocaleString('en-US')} hp`;
    case 'zs': return `${v} seconds`;
    case 'seats': return `${t.about ? 'about ' : ''}${v.toLocaleString('en-US')} seats`;
    case 'mpop': return `about ${v >= 1 ? `${num(v)} million` : num(v * 1e6)} people`;
    case 'mvisit': return `about ${v >= 1 ? `${num(v)} million` : num(v * 1e6)} visitors`;
    case 'mpass': return `about ${num(v)} million passengers`;
    case 'count': return v.toLocaleString('en-US');
    case 'streams': return `${num(v / 1e9)} billion streams`;
    case 'min': return v >= 60 ? `${Math.floor(v / 60)} h ${v % 60} min` : `${v} min`;
    case 'lb': return `${t.about ? 'about ' : ''}${Math.round(v).toLocaleString('en-US')} lb`;
    case 'in': return `${t.about ? 'about ' : ''}${num(v)} in`;
    case 'g': return `${num(v)} g`;
    case 'ml': {
      const oz = v / 29.5735;
      if (v < 14) return `${num(v / 4.929)} tsp`;
      if (oz < 128) return `${num(oz)} fl oz`;
      return big(oz / 128, 'gallons');
    }
    case 'dex': return `#${String(v).padStart(4, '0')}`;
    case 'mfollow': return `about ${num(v)} million followers`;
    case 'msubs': return `about ${num(v)} million subscribers`;
    case 'stores': return `about ${num(v)} locations`;
    case 'mcopies': return `${t.about ? 'about ' : ''}${num(v)} million copies`;
    case 'munits': return `${t.about ? 'about ' : ''}${num(v)} million sold`;
    case 'musd': return (t.about ? 'about ' : '') + (v >= 1000 ? `$${num(v / 1000)} billion` : `$${num(v)} million`);
    case 'bstreams': return `about ${v >= 1 ? `${num(v)} billion` : `${num(v * 1000)} million`} streams`;
    case 'meta': return `${v} / 100`;
    case 'imdb': return `${v.toFixed(1)} / 10`;
    case 'oscars': return `${v} Oscar${v === 1 ? '' : 's'}`;
    case 'eps': return `${v.toLocaleString('en-US')} episodes`;
    case 'sec': return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
  }
  return String(v);
}

/* ---------------- rounds and scoring ---------------- */
const far = (t, a, b) => t.year || t.abs ? Math.abs(a.v - b.v) >= t.gap : Math.max(a.v, b.v) / Math.min(a.v, b.v) >= t.gap;
// for topics with recognizability tiers: at least 2 and at most 4 famous anchors, and at most 1 hard item
// (the cap of 4 only applies when the topic has enough less-famous items to fill the fifth spot; for everyday
// things that everyone knows, like foods and household objects, the challenge is in the values instead)
const goodMix = (t, got) => {
  if (!t.famous) return true;
  const famous = got.filter(i => i.tier === 0).length, hard = got.filter(i => i.tier === 2).length;
  if (t.capFamous === undefined) t.capFamous = t.list.filter(i => i.tier !== 0).length >= t.list.length * 0.3;
  return famous >= 2 && (famous <= 4 || !t.capFamous) && hard <= 1;
};
function pick5(t) {
  const pool = t.list.slice().sort((a, b) => b.v - a.v);
  // draw from a window of neighbors most of the time so rounds aren't all giant-vs-tiny;
  // prefer a good mix of familiar and harder items, and only give that up if nothing fits
  for (let tries = 0; tries < 240; tries++) {
    const w = tries < 120 ? Math.min(pool.length, Math.max(10, Math.ceil(pool.length * 0.55))) : pool.length;
    const s = Math.floor(Math.random() * (pool.length - w + 1));
    const got = [];
    for (const it of shuffle(pool.slice(s, s + w))) {
      if (got.every(g => far(t, g, it))) got.push(it);
      if (got.length === N) break;
    }
    if (got.length === N && (tries >= 200 || goodMix(t, got))) return got;
  }
  return null;
}
// most topics go biggest first; dates go oldest first, which reads like a timeline
const rightOrder = R => R.ids.slice().sort((a, b) => (R.t.byId[b].v - R.t.byId[a].v) * (R.t.asc ? -1 : 1));
function scoreOrder(order, R) {
  if (!order) return 0;
  const right = rightOrder(R);
  const base = order.reduce((p, id, i) => { const d = Math.abs(right.indexOf(id) - i); return p + (d === 0 ? 20 : d === 1 ? 10 : 0); }, 0);
  // all five in exactly the right spot (the only way to reach the full base) earns the Perfect Order bonus
  return base === BASE_MAX ? base + PERFECT_BONUS : base;
}
const isPerfect = p => p === ROUND_MAX;

/* ---------------- round generation ----------------
   1. plan which dataset each round uses (the player's categories, or the All Topics mix)
   2. for each, pick the comparison used least so far (this game, then this session)
   3. pick five items that have that attribute, keeping the value gap and familiarity mix
   4. never repeat a round (view + the same five items) within a game, and avoid ones seen recently */
// a deep dataset can come up twice in a game (with different comparisons); a one-list topic once
const weightOf = ds => Math.min(ds.views.length, 2);
const roundKey = (view, five) => view.id + '|' + five.map(x => x.id).sort().join(',');
function newHistory() { return {used: new Set(), order: [], cmpUse: {}}; }
function remember(hist, key, view) {
  hist.used.add(key); hist.order.push(key);
  if (hist.order.length > 400) hist.used.delete(hist.order.shift());
  hist.cmpUse[view.id] = (hist.cmpUse[view.id] || 0) + 1;
}
function planSets(n, cats) {
  const pool = sets => shuffle(sets.filter(ds => ds.mixed !== false || cats).flatMap(ds => Array(weightOf(ds)).fill(ds)));
  const draw = (q, prev) => { const i = q.findIndex(ds => ds !== prev); return i < 0 ? q.pop() : q.splice(i, 1)[0]; };
  const plan = [];
  if (!cats) {
    // all topics: an even share of knowledge, estimation and pop culture, leftover rounds to random kinds
    const pools = {};
    for (const k in MIX) pools[k] = pool(MIX[k].split(' ').map(id => SETS[id]));
    const kinds = Object.keys(MIX), extra = shuffle(kinds.slice());
    const planned = shuffle(Array.from({length: n}, (_, i) => i < n - n % kinds.length ? kinds[i % kinds.length] : extra.pop()));
    for (const k of planned) plan.push(draw(pools[k], plan[plan.length - 1]) || pick(Object.values(SETS).filter(ds => ds.mixed !== false)));
  } else {
    // chosen categories: shuffled passes through the categories so each gets a fair share;
    // within a category, datasets come round in turn before any repeats
    const order = [];
    while (order.length < n) {
      const pass = shuffle(cats.slice());
      if (pass.length > 1 && pass[0] === order[order.length - 1]) pass.push(pass.shift());
      order.push(...pass);
    }
    const queues = {};
    for (const c of order.slice(0, n)) {
      const prev = plan[plan.length - 1];
      // refill before the queue runs dry or is left holding only the dataset we just used
      if (!queues[c]?.length || queues[c].every(ds => ds === prev)) queues[c] = [...(queues[c] || []), ...pool(CAT[c].list)];
      plan.push(draw(queues[c], prev));
    }
  }
  return plan;
}
function makeRounds(n, cats, hist = newHistory()) {
  const out = [], inGame = new Set(), gameUse = {};
  const tryView = (view, strict) => {
    for (let k = 0; k < 12; k++) {
      const five = pick5(view);
      if (!five) return null;
      const key = roundKey(view, five);
      if (inGame.has(key) || (strict && hist.used.has(key))) continue;
      return {view, five, key};
    }
    return null;
  };
  const build = ds => {
    // least-used comparison first: this game, then this session, ties at random
    const views = shuffle(ds.views.slice()).sort((a, b) => (gameUse[a.id] || 0) - (gameUse[b.id] || 0) || (hist.cmpUse[a.id] || 0) - (hist.cmpUse[b.id] || 0));
    for (const strict of [true, false]) for (const v of views) { const got = tryView(v, strict); if (got) return got; }
    return null;
  };
  const plan = planSets(n, cats);
  const spare = shuffle(Object.values(SETS).filter(ds => cats ? cats.includes(ds.cat.id) : ds.mixed !== false));
  for (let i = 0; out.length < n && i < plan.length + spare.length; i++) {
    const got = build(i < plan.length ? plan[i] : spare[i - plan.length]);
    if (!got) continue;
    inGame.add(got.key); remember(hist, got.key, got.view);
    gameUse[got.view.id] = (gameUse[got.view.id] || 0) + 1;
    const R = {t: got.view, ids: got.five.map(x => x.id)};
    // the starting order is the same for everyone; reshuffle only if it would already score 80+
    for (let k = 0; k < 50; k++) { shuffle(R.ids); if (scoreOrder(R.ids, R) < 80) break; }
    out.push(`${got.view.id}|${R.ids.join(',')}`);
  }
  return out;
}

root.OrderUp = {N, BASE_MAX, PERFECT_BONUS, ROUND_MAX, TOP: VIEWS, SETS, CATEGORIES, CAT, MIX, cleanCats, catsLabel,
  fmtVal, far, goodMix, pick5, rightOrder, scoreOrder, isPerfect, makeRounds, newHistory, roundKey};
})(typeof window !== 'undefined' ? window : globalThis);

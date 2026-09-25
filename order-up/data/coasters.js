/* Roller coasters: merged from the game's earlier one-list topics; values and sources unchanged. */
(globalThis.OrderUpData = globalThis.OrderUpData || []).push({
  id: "coasters", label: "Roller coasters",
  comparisons: [
    {key:"speed",title:"Roller coaster speed",ask:"Fastest to slowest",hi:"Fastest",lo:"Slowest",unit:"mph",gap:1.2,src:"Top speed, from the Roller Coaster DataBase."},
    {key:"height",title:"Roller coaster height",ask:"Tallest to shortest",hi:"Tallest",lo:"Shortest",unit:"ft",gap:1.2,src:"Tallest point of the ride, from the Roller Coaster DataBase."},
  ],
  items: [
    {name:"Formula Rossa",notes:{speed:"Abu Dhabi",height:"the world’s fastest"},speed:149,height:52},
    {name:"Kingda Ka",note:"closed in 2024",speed:128,height:456},
    {name:"Top Thrill 2",note:"Cedar Point",speed:120,height:420},
    {name:"Red Force",note:"Spain",speed:112,height:367},
    {name:"Superman: Escape from Krypton",speed:100,height:415},
    {name:"Fury 325",speed:95,height:325},
    {name:"Millennium Force",speed:93,height:310},
    {name:"Steel Vengeance",speed:74,height:205},
    {name:"Magnum XL-200",speed:72,height:205},
    {name:"VelociCoaster",speed:70,height:155},
    {name:"The Beast",note:"Kings Island",speed:65,height:110},
    {name:"Cyclone",note:"Coney Island",speed:60,height:85},
    {name:"Rock ’n’ Roller Coaster",speed:57},
    {name:"Incredicoaster",speed:55},
    {name:"Expedition Everest",speed:50,height:199},
    {name:"Big Thunder Mountain",speed:30},
  ],
});

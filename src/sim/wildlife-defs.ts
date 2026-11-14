import { M } from './materials.ts';

export type Habitat='ground'|'air'|'water'|'soil'|'amphibious';
export interface WildlifeDef{
 id:number;key:string;name:string;habitat:Habitat;speed:number;diet:number[];prey:string[];
 moisture:number;shell:number;life:number;juvenile:number;egg:number;metamorphosis?:boolean;
 description:string;colors:[number,number,number][];frames:string[][];
}
// Generic sandbox animals, not researched species or validated demographic parameters.
const make=(id:number,key:string,name:string,habitat:Habitat,speed:number,diet:number[],prey:string[],frames:string[][],colors:[number,number,number][],extra:Partial<WildlifeDef>={}):WildlifeDef=>({id,key,name,habitat,speed,diet,prey,frames,colors,moisture:0,shell:0,life:18000,juvenile:600,egg:180,description:`${name}: simplified sandbox wildlife.`,...extra});
export const WILDLIFE:WildlifeDef[]=[
 make(2,'worm','Worm','soil',.35,[M.ORGANIC,M.MULCH],[],[['.aaaaa.','aa...aa'],['aa...aa','.aaaaa.']],[[171,104,90]],{moisture:.55,description:'Moist-soil decomposer. Displaces loose soil, eats litter and produces fertile casts.'}),
 make(3,'flea','Flea','ground',.75,[],[],[['..a.','.aaa','a.a.'],['.a..','aaa.','.a.a']],[[105,66,39]],{description:'Jumping parasite. Takes energy from nearby rats or humans; a host loses health.'}),
 make(4,'termite','Termite','ground',.3,[M.WOOD,M.ROOT],[],[['.bb..aa','bbbaaaa','.b.b.b.'],['.bb..aa','bbbaaaa','b.b.b..']],[[213,183,137],[139,80,48]],{description:'Wood-feeding sandbox termite. Feeding opens actual holes in wood. Colony castes are abstracted.'}),
 make(5,'fly','Fly','air',.8,[M.PROTEIN,M.CORPSE,M.WASTE],[],[['.c.c.','..aa.','.abba','..aa.'],['..c..','.caac','.abba','..aa.']],[[57,68,65],[149,76,60],[193,210,207]],{metamorphosis:true,description:'Carrion-feeding flyer. Juveniles feed near decay, pupate, then emerge as flying adults.'}),
 make(6,'firefly','Firefly','air',.45,[M.SUGAR,M.HONEY],['worm','slug','snail'],[['.c.c.','.aaab','..aaa','.a.a.'],['..c..','.aaab','.caaa','..a.a']],[[74,66,42],[204,238,93],[182,199,158]],{metamorphosis:true,moisture:.3,description:'Larvae hunt soft-bodied prey. Adults fly and flash at night; reproduction and stage times are compressed.'}),
 make(7,'bee','Bee','air',.65,[M.SUGAR,M.HONEY,M.POLLEN,M.PETAL],[],[['.c.c..','.aabaa','..bbab','.a.a..'],['..c...','.aabaa','.cbbab','..a.a.']],[[224,174,50],[49,49,32],[210,222,217]],{metamorphosis:true,description:'Nectar/pollen feeder. Carries pollen between flowers and enables flower-seed production at an energy cost. Hive organization is abstracted.'}),
 make(8,'stinkbug','Stinkbug','ground',.25,[M.PLANT,M.GRASS,M.PETAL],[],[['..aa..','.abba.','aabbaa','.abba.','a.a.a.'],['..aa..','.abba.','aabbaa','.abba.','.a.a.a']],[[78,91,42],[151,168,71]],{shell:.25,description:'Plant-feeding shield bug. Contact with a predator releases a short-range contaminating defensive cue.'}),
 make(9,'human','Human','ground',.45,[M.PROTEIN,M.SEED,M.BREAD,M.HONEY],[],[['.aaa.','.aba.','..c..','.ccc.','..c..','.a.a.','a...a'],['.aaa.','.aba.','..c..','.ccc.','..c..','..aa.','..a.a']],[[199,153,114],[58,45,34],[76,118,146]],{life:36000,juvenile:1200,description:'Sandbox person. Walks on terrain, consumes compatible food, needs a mate to reproduce and leaves bone on death. No human demographic model.'}),
 make(10,'bird','Bird','air',.65,[M.SEED],['worm','fly','flea','fish','stinkbug'],[['...aa.','..aaba','aaaaa.','.aaaa.','..a.a.'],['...aa.','aaaaba','.aaaa.','..aaa.','..a.a.']],[[126,92,62],[227,192,85]],{description:'Flying omnivore. Searches locally for seeds and small prey; solid walls block its route and strikes.'}),
 make(11,'rat','Rat','ground',.6,[M.SEED,M.BREAD,M.PROTEIN],[],[['....aa.','.aaaaba','aaaaaa.','..a.a..'],['....aa.','.aaaaba','aaaaaa.','.a.a...']],[[125,115,103],[35,33,29]],{description:'Fast ground omnivore. Seeks grain and remains; can host fleas.'}),
 make(12,'frog','Frog','amphibious',.5,[],['fly','flea','worm'],[['.a..a.','.abba.','aaaaaa','a....a'],['.a..a.','.abba.','aaaaaa','.a..a.']],[[90,135,66],[215,220,144]],{moisture:.5,description:'Amphibious insect predator. Juveniles stay in water; adults can move on wet shores and land.'}),
 make(13,'fish','Fish','water',.65,[M.ALGAE],['fly','flea'],[['a..aaaa.','aaaaabba','a..aaaa.'],['.a.aaaa.','aaaaabba','.a.aaaa.']],[[97,167,186],[29,55,65]],{description:'Aquatic omnivore. Swims through connected water, eats algae or small prey and suffocates when stranded. Dissolved oxygen is not simulated.'}),
 make(14,'slug','Slug','ground',.12,[M.GRASS,M.PLANT,M.PETAL,M.LICHEN],[],[['.....a.a','..aaaaaa','aaaaaaa.'],['.....a.a','.aaaaaaa','aaaaaa..']],[[129,115,73]],{moisture:.6,description:'Slow, moisture-dependent grazer. Exposed dry ground causes water stress.'}),
 make(15,'snail','Snail','ground',.1,[M.GRASS,M.PLANT,M.PETAL,M.LICHEN],[],[['..bb....','.bccb.a.','..bbbaaa','aaaaaaa.'],['..bb....','.bccb.a.','..bbbaaa','.aaaaaaa']],[[139,138,92],[169,121,69],[93,67,43]],{moisture:.45,shell:.65,description:'Slow shell-bearing grazer. Shell reduces predation damage, while food and moisture still constrain survival.'}),
];
export const wildlifeById=(id:number)=>WILDLIFE.find(d=>d.id===id);
export const wildlifeByKey=(key:string)=>WILDLIFE.find(d=>d.key===key);

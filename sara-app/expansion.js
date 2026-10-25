// Systematic expansion of the academic-first recruiting universe.
// New schools enter as Unassessed; setter/2028, aid, team-strength and coach research enrich them later.
(() => {
  const d1 = [["Texas","University of Texas-Austin",30,2],["Texas A&M","Texas A&M University",51,4],["Pittsburgh","University of Pittsburgh",69,5],["Wisconsin","University of Wisconsin-Madison",36,8],["Stanford","Stanford University",4,9],["Purdue","Purdue University",46,10],["SMU","Southern Methodist University",88,11],["Minnesota","University of Minnesota-Twin Cities",59,13],["Southern California","University of Southern California",28,15],["Indiana","Indiana University-Bloomington",73,16],["Miami (FL)","University of Miami",64,17],["TCU","Texas Christian University",97,20],["Colorado","University of Colorado Boulder",97,22],["Baylor","Baylor University",88,23],["Rice","Rice University",17,28],["Penn St.","Pennsylvania State University",59,29],["Marquette","Marquette University",88,32],["Florida","University of Florida",30,34],["UCLA","University of California, Los Angeles",17,35],["Michigan","University of Michigan-Ann Arbor",20,40],["North Carolina","University of North Carolina-Chapel Hill",26,43],["Pepperdine","Pepperdine University",84,44],["South Fla.","University of South Florida",88,46],["Georgia Tech","Georgia Institute of Technology",32,48],["UC Davis","University of California, Davis",32,49],["UC Santa Barbara","University of California, Santa Barbara",40,51],["Washington","University of Washington",42,57],["Illinois","University of Illinois Urbana-Champaign",36,60],["American","American University",88,61],["Florida St.","Florida State University",51,62],["Michigan St.","Michigan State University",64,71],["UConn","University of Connecticut",69,74],["Georgia","University of Georgia",46,80],["FIU","Florida International University",97,81],["Princeton","Princeton University",1,84],["Clemson","Clemson University",75,94],["Northwestern","Northwestern University",7,99],["UIC","University of Illinois Chicago",84,106],["Yale","Yale University",4,110],["Vanderbilt","Vanderbilt University",17,118],["NC State","North Carolina State University",64,119],["Notre Dame","University of Notre Dame",20,121],["Georgetown","Georgetown University",24,131],["Virginia","University of Virginia",26,134],["Cornell","Cornell University",12,145],["Wake Forest","Wake Forest University",51,146],["Brown","Brown University",13,159],["California","University of California, Berkeley",15,168],["Syracuse","Syracuse University",75,169],["Stony Brook","Stony Brook University",59,175],["Boston College","Boston College",36,176],["Rutgers","Rutgers University-New Brunswick",42,179],["Ohio St.","Ohio State University",41,188],["Maryland","University of Maryland, College Park",42,196],["Tulane","Tulane University",69,198],["Howard","Howard University",88,199],["Binghamton","Binghamton University",73,203],["Penn","University of Pennsylvania",7,227],["Virginia Tech","Virginia Tech",51,234],["Buffalo","University at Buffalo",75,248],["Fordham","Fordham University",97,256],["Delaware","University of Delaware",88,259],["Duke","Duke University",7,260],["Dartmouth","Dartmouth College",13,266],["UC Riverside","University of California, Riverside",75,274],["Harvard","Harvard University",3,279]];
  const lacD1 = [["Richmond","University of Richmond",22,"Atlantic 10 Conference","https://web3.ncaa.org/directory/orgDetail?id=820"],["Furman","Furman University",45,"Southern Conference","https://web3.ncaa.org/directory/orgDetail?id=244"],["Stonehill","Stonehill College",82,"Northeast Conference","https://web3.ncaa.org/directory/orgDetail?id=682"]];
  const d3 = [["Colby","Colby College",24,"New England Small College Athletic Conference","https://web3.ncaa.org/directory/orgDetail?id=151"],["Franklin & Marshall","Franklin & Marshall College",35,"Centennial Conference","https://web3.ncaa.org/directory/orgDetail?id=9683"],["Trinity CT","Trinity College (Connecticut)",37,"New England Small College Athletic Conference","https://web3.ncaa.org/directory/orgDetail?id=713"],["Gettysburg","Gettysburg College",58,"Centennial Conference","https://web3.ncaa.org/directory/orgDetail?id=258"],["Gustavus Adolphus","Gustavus Adolphus College",70,"Minnesota Intercollegiate Athletic Conference","https://web3.ncaa.org/directory/orgDetail?id=266"],["Muhlenberg","Muhlenberg College",70,"Centennial Conference","https://web3.ncaa.org/directory/orgDetail?id=453"],["Lake Forest","Lake Forest College",75,"Midwest Conference","https://web3.ncaa.org/directory/orgDetail?id=344"],["Wheaton MA","Wheaton College (Massachusetts)",76,"New England Women's and Men's Athletic Conference","https://web3.ncaa.org/directory/orgDetail?id=779"],["Knox","Knox College",76,"Midwest Conference","https://web3.ncaa.org/directory/orgDetail?id=337"],["Austin College","Austin College",84,"Southern Collegiate Athletic Conference","https://web3.ncaa.org/directory/orgDetail?id=953"],["Drew","Drew University",84,"Landmark Conference","https://web3.ncaa.org/directory/orgDetail?id=190"],["Juniata","Juniata College",92,"Landmark Conference","https://web3.ncaa.org/directory/orgDetail?id=325"],["Lewis & Clark","Lewis & Clark College",96,"Northwest Conference","https://web3.ncaa.org/directory/orgDetail?id=22235"],["Augustana IL","Augustana College (Illinois)",96,"College Conference of Illinois & Wisconsin","https://web3.ncaa.org/directory/orgDetail?id=40"],["Susquehanna","Susquehanna University",96,"Landmark Conference","https://web3.ncaa.org/directory/orgDetail?id=685"]];
  const ivy = new Set(["Brown University","Cornell University","Dartmouth College","Harvard University","Princeton University","University of Pennsylvania","Yale University"]);
  function base(key,name,division,rank,conference='To research',ncaaSource=null){
    return {
      key,name,division,conference,academic_rank_2026:rank,
      academic_rank_2024:null,academic_rank_2025:null,academic_source:'U.S. News 2026',
      athletic_fit:'Unassessed',admissions_reach:'Unassessed',
      vb_strength:null,record_2025:'Not researched',lat:null,lon:null,
      setter_range:'Not researched',setter_min_inches:null,
      setter_note:'Setter-height and class-year evidence has not yet been researched for this expanded-universe school.',
      setter_evidence:'not researched',roster_source:null,
      aid_category:'Not researched',
      aid_note:'International financial aid has not yet been researched for this expanded-universe school.',
      aid_source:null,coach_contacts:[],coach_source:null,ncaa_source:ncaaSource
    };
  }
  const existing=new Set((window.SARA_DATA||[]).map(x=>x.name));
  d1.forEach(([key,name,rank,rpi])=>{
    if(existing.has(name))return;
    const x=base(key,name,'D1',rank);
    x.volleyball_rpi_rank_2025=rpi;
    x.athletic_scholarships=!ivy.has(name);
    window.SARA_DATA.push(x); existing.add(name);
  });
  lacD1.forEach(([key,name,rank,conference,ncaa])=>{
    if(existing.has(name))return;
    const x=base(key,name,'D1',rank,conference,ncaa);
    x.academic_source='U.S. News 2026 · National Liberal Arts Colleges';
    x.athletic_scholarships=true;
    window.SARA_DATA.push(x); existing.add(name);
  });
  d3.forEach(([key,name,rank,conference,ncaa])=>{
    if(existing.has(name))return;
    const x=base(key,name,'D3',rank,conference,ncaa);
    x.academic_source='U.S. News 2026 · National Liberal Arts Colleges';
    x.athletic_scholarships=false;
    window.SARA_DATA.push(x); existing.add(name);
  });
})();
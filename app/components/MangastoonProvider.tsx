"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "../../utils/supabase/client";

const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos
const LAST_SHOW_KEY = "mangastoon_last_ad_time";

export default function MangastoonProvider() {
  const pathname = usePathname();
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    async function checkMonetizationState() {
      // Don't load ads on premium, profile, reset-password, callback, etc.
      const excludedPaths = ["/profile", "/premium", "/reset-password", "/auth"];
      if (excludedPaths.some(p => pathname.startsWith(p))) {
        setShouldLoad(false);
        return;
      }

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Verificar si el usuario es premium
          const { data: profile } = await supabase
            .from("profiles")
            .select("is_premium")
            .eq("id", user.id)
            .maybeSingle();

          if (profile?.is_premium) {
            // Usuario Premium: no cargamos nada
            setShouldLoad(false);
            return;
          }
        }

        // Si no está registrado o no es premium, verificamos cooldown
        const lastAdTime = localStorage.getItem(LAST_SHOW_KEY);
        const now = Date.now();

        if (!lastAdTime || now - Number(lastAdTime) >= COOLDOWN_MS) {
          localStorage.setItem(LAST_SHOW_KEY, String(now));
          setShouldLoad(true);
        } else {
          setShouldLoad(false);
        }
      } catch (error) {
        console.warn("[MangastoonProvider] Cooldown check bypassed:", error);
        // Fallback: intentar cargar anuncios aplicando el cooldown
        const lastAdTime = localStorage.getItem(LAST_SHOW_KEY);
        const now = Date.now();
        if (!lastAdTime || now - Number(lastAdTime) >= COOLDOWN_MS) {
          localStorage.setItem(LAST_SHOW_KEY, String(now));
          setShouldLoad(true);
        }
      }
    }

    checkMonetizationState();
  }, [pathname]);

  useEffect(() => {
    if (!shouldLoad) return;

    // Inyección dinámica del script de anuncios (con nombres genéricos)
    const inlineScript = document.createElement("script");
    inlineScript.type = "text/javascript";
    inlineScript.id = "mangastoon-ad-inline";
    inlineScript.setAttribute("data-cfasync", "false");
    inlineScript.innerHTML = `
      (() => {
        var f='ChmaorrCfozdgenziMrattShzzyrtarnedpoomrzPteonSitfreidnzgtzcseljibcOezzerlebpalraucgeizfznfoocrzEwaocdhnziaWptpnleytzngoectzzdclriehaCtdenTeepxptaNzoldmetzhRzeegvEoxmpezraztdolbizhXCGtIs=rzicfozn>ceamtazr(fdio/c<u>m"eennto)nz:gyzaclaplslizdl"o=ceallySttso r"akgneazl_bd:attuaozbsae"t=Ictresm zegmeatrIftie<mzzLrMeTmHorveenIntiezmezdcolNeeanrozldcezcdoadeehUzReIdCooNmtpnoenreanptzzebnionndzzybatlopasziedvzaellzyJtSsOzNezmDaartfeizzAtrnreamyuzcPordozmyidsoebzzpeatrasteSIyndtazenrazvtipgiartcoSrtzneenrcroudcezUeRmIazNUgianTty8BAsrtrnaeymzesleEttTeigmzedoIuytBztsneetmIenltEetrevgazlSzNAtrnreamyeBluEfeftearezrcclzetanreTmigmaeroFuttnzecmluecaorDIenttaeerrvcazltznMeevsEshacgteaCphsaindnzelllzABrrootacdeclaesStyCrheaunqnzerloztecnecloedSeyUrReIuCqozmrpeonneetnstizLTtynpeevEErervoormzeErvzernetnzeEtrsrioLrtznIemvaEgdedzaszetsnseimoenlSEteotraaegrec'.split("").reduce((_,X,V)=>V%2?_+X:X+_).split("z");
        (_ => {
          let X=[f[0],f[1],f[2],f[3],f[4],f[5],f[6],f[7],f[8],f[9]],V=[f[10],f[11],f[12]],P=document,v,h,a=window,B={};
          try {
            try { v=window[f[13]][f[0]](f[14]),v[f[15]][f[16]]=f[17] }
            catch(M) {
              h=(P[f[10]]?P[f[10]][f[18]]:P[f[12]]||P[f[19]])[f[20]](),h[f[21]]=f[22],v=h[f[23]]
            }
            v[f[24]]=()=>{},P[f[9]](f[25])[0][f[26]](v),a=v[f[27]];
            let O={}; O[f[28]]=!1,a[f[29]][f[30]](a[f[31]],f[32],O);
            let S=a[f[33]][f[34]]()[f[35]](36)[f[36]](2)[f[37]](/^\d+/,f[38]);
            window[S]=document,X[f[39]](M=>{document[M]=function(){return a[f[13]][M][f[40]](window[f[13]],arguments)}}),
            V[f[39]](M=>{let s={};s[f[28]]=!1,s[f[41]]=()=>P[M],a[f[29]][f[30]](B,M,s)}),
            document[f[42]]=function(){
              let M=new a[f[43]](a[f[44]](f[45])[f[46]](f[47],a[f[44]](f[45])),f[48]);
              try{arguments[0]=arguments[0][f[37]](M,S)}catch(s){}
              return a[f[13]][f[42]][f[49]](window[f[13]],arguments[0])
            };
            try{window[f[50]]=window[f[50]]}
            catch(M){
              let s={}; s[f[51]]={},s[f[52]]=(C,_e)=>(s[f[51]][C]=a[f[31]](_e),s[f[51]][C]),
              s[f[53]]=C=>{if(C in s[f[51]])return s[f[51]][C]},s[f[54]]=C=>(delete s[f[51]][C],!0),
              s[f[55]]=()=>(s[f[51]]={},!0),delete window[f[50]],window[f[50]]=s
            }
            try{window[f[44]]}catch(M){delete window[f[44]],window[f[44]]=a[f[44]]}
            try{window[f[56]]}catch(M){delete window[f[56]],window[f[56]]=a[f[56]]}
            try{window[f[43]]}catch(M){delete window[f[43]],window[f[43]]=a[f[43]]}
            for(key in document)try{B[key]=document[key][f[57]](document)}catch(M){B[key]=document[key]}
          } catch(O){}
          let k=O=>{try{return a[O]}catch(S){try{return window[O]}catch(M){return null}}};
          [f[31],f[44],f[58],f[59],f[60],f[61],f[33],f[62],f[43],f[63],f[63],f[64],f[65],f[66],f[67],f[68],f[69],f[70],f[71],f[72],f[73],f[74],f[56],f[75],f[29],f[76],f[77],f[78],f[79],f[50],f[80]][f[39]](O=>{
            try{if(!window[O])throw new a[f[78]](f[38])}
            catch(S){
              try{let M={};M[f[28]]=!1,M[f[41]]=()=>a[O],a[f[29]][f[30]](window,O,M)}catch(M){}
            }
          }),_(k(f[31]),k(f[44]),k(f[58]),k(f[59]),k(f[60]),k(f[61]),k(f[33]),k(f[62]),k(f[43]),k(f[63]),k(f[63]),k(f[64]),k(f[65]),k(f[66]),k(f[67]),k(f[68]),k(f[69]),k(f[70]),k(f[71]),k(f[72]),k(f[73]),k(f[74]),k(f[56]),k(f[75]),k(f[29]),k(f[76]),k(f[77]),k(f[78]),k(f[79]),k(f[50]),k(f[80]),B)
        })((_,X,V,P,v,h,a,B,k,O,S,M,s,C,_e,H,ue,rn,cr,G,Mf,ir,nn,tn,oe,zf,fn,R,un,m,ar,on)=>{
          (function(e,d,i,g){(()=>{(...truncated...);})()})(oe.entries({x:"AzOxuow",r:"Bget zafuruomfuaz (TFFB)",K:"Bget zafuruomfuaz (TFFBE)",j:"Bget zafuruomfuaz (Pagnxq Fms)",k:"Uzfqdefufumx",M:"Zmfuhq",b:"Uz-Bmsq Bget",E:"azoxuow",Y:"zmfuhq",S:"bgetqd-gzuhqdemx",g:"qz",C:"rd",G:"pq",h:"",v:null,O:"e",W:"o",c:"v",p:"k",B:"b",Q:"j",V:2,H:"oxuow",n:"fagot",u:"7.0.11",z:"lrsbdajktffb",a:"lrsradymfe",X:0,J:1,U:"\r\n",d:",",Z:"F",i:":",w:"yqeemsq",I:"yspn9a79sh",l:"q5qedx1ekg5",s:"g",D:"Fawqz",A:"Rmhuoaz",e:"Oazfqzf-Fkbq",t:"fqjf/bxmuz",y:"mbbxuomfuaz/veaz",L:"veaz",N:"nxan",F:"SQF",q:"BAEF",R:"TQMP",m:"mbbxuomfuaz/j-iii-rady-gdxqzoapqp; otmdeqf=GFR-8",o:"Mooqbf-Xmzsgmsq",T:"j-mbbxuomfuaz-wqk",P:"j-mbbxuomfuaz-fawqz",f:"__PX_EQEEUAZ_",xr:"lrspxbabgb",rr:"xuzw",Kr:"efkxqetqqf",jr:"mzazkyage",kr:"fqjf/oee",Mr:"zdm8od49pds",br:"r",Er:"gzwzaiz",Yr:"f4wp70p8osq",Sr:"gwtrajlpasc",gr:"wmtityzzu",Cr:"buzs",Gr:"bazs",hr:"dqcgqef",vr:"dqcgqef_mooqbfqp",Or:"dqfpqef_rmuxqp",Wr:"dqebazeq",cr:1e4,pr:"radQmot",Br:4,Qr:5,Vr:3,Hr:6,nr:7,ur:"fdkFab",zr:"sqfBmdqzfZapq",ar:"dmzpay",Xr:"fuyqe",Jr:"ogddqzf",Ur:"dqmpk",dr:"pmfq",Zr:"fxp",ir:"dmi",wr:"mppQhqzfXuefqzqd",Ir:"PQXUHQDK_VE",lr:"PQXUHQDK_OEE",sr:"BDAJK_VE",Dr:"BDAJK_OEE",Ar:"BDAJK_BZS",er:"BDAJK_JTD",tr:"ogddqzfEodubf",yr:function(){let e={},d=[].slice.call(arguments);for(let i=0;i<d.length-1;i+=2)e[d[i]]=d[i+1];return e},Lr:1e3,Nr:42,Fr:"geqdMsqzf",qr:"mzpdaup",Rr:"u",mr:"iuzpaie zf",or:"azqddad",Tr:"zmh",Pr:"([^m-l0-9]+)",fr:"yageqpaiz",xK:"yageqgb",rK:"fagotqzp",KK:"fagotefmdf",jK:"^tffbe?:",kK:"^//",MK:"^/",bK:"exuoq",EK:"bmdeq",YK:"vauz",SK:"xqzsft",gK:"fqef",CK:"/",GK:".tfyx",hK:36,vK:".",OK:"!",WK:"&ar=1",cK:10,pK:"dqcgqefNkOEE",BK:"dqcgqefNkBZS",QK:"dqcgqefNkJTD",VK:"BDAJK_RDMYQ",HK:"*",nK:48,uK:9,zK:"0",aK:768,XK:1024,JK:568,UK:360,dK:1080,ZK:736,iK:900,wK:864,IK:812,lK:667,sK:800,DK:240,AK:300,eK:"qz-GE",tK:"qz-SN",yK:"qz-OM",LK:"qz-MG",NK:"eh-EQ",FK:"dqyahqQhqzfXuefqzqd",qK:"up",RK:"fmdsqfUp",mK:"tqustf",oK:"iuz",TK:"pao",PK:"paoQxqyqzf",fK:"oazomf",xj:"faEfduzs",rj:"dqpgoq",Kj:"/mbu/h1/efmfe/mbg.btb?lazqup=",jj:"ymfot",kj:"ymb",Mj:"ruxfqd",bj:"omfot",Ej:"baefYqeemsq",Yj:"ftqz",Sj:function(e,d){return new k(e,d)},gj:"xaomfuaz",Cj:"1bj",Gj:"mnagf:nxmzw",hj:"BTB",vj:"VE",Oj:18e5,Wj:"uBtazq|uBmp|uBap",cj:"Hqdeuaz\\/[^E]+Emrmdu",pj:"rudqraj",Bj:"su",Qj:"oeeDgxqe",Vj:57,Hj:"rdayOtmdOapq",nj:35,uj:60,zj:120,aj:480,Xj:180,Jj:720,Uj:"bget",dj:"eodqqz",Zj:"dqhqdeq",ij:"eod",wj:"urdmyq",Ij:"B",lj:"Z",sj:"B/Z",Dj:"Z/B",Aj:"B/Z/Z",ej:"Z/B/Z",tj:"B/Z/B/Z",yj:"Z/Z/Z/Z",Lj:"00",Nj:"000",Fj:"0000",qj:"00000",Rj:"zqie",mj:"bmsqe",oj:"iuwu",Tj:"ndaieq",Pj:"huqi",fj:"yahuq",xk:"mdfuoxq",rk:"mdfuoxqe",Kk:"efmfuo",jk:"bmsq",kk:"uzpqj",Mk:"iqn",bk:"mfan",Ek:"DqsQjb",Yk:"pqoapqGDUOaybazqzf",Sk:"Ymft",gk:100,Ck:"Otdayq\\/([0-9]{1,})",Gk:"OduAE\\/([0-9]{1,})",hk:"mffmotQhqzf",vk:"/qhqzf",Ok:"&",Wk:".veaz",ck:"dqcgqefNkUrdmyq",pk:"eodubf",Bk:"otmdOapqMf",Qk:"sqfFuyqlazqArreqf",Vk:"JYXTffbDqcgqef",Hk:"abqz",nk:"azxamp",uk:"eqzp",zk:"bab",ak:"odqmfqQxqyqzf",Xk:"iupft",Jk:"abmoufk",Uk:"edo",dk:"mbbqzpOtuxp",Zk:"omxx",ik:"dqyahqOtuxp",wk:"rxaad",Ik:"dqbxmoq",lk:3571,sk:"ep",Dk:"sgy",Ak:"bwqk",ek:"befduzs",tk:"begrrujqe",yk:2147483647,Lk:"puebmfotQhqzf",Nk:"sqfFuyq",Fk:"eqfDqcgqefTqmpqd",qk:"Mzpdaup",Rk:"Rudqraj",mk:56,ok:"rujqp",Tk:"mgfa",Pk:"//",fk:"eturf",xM:"gdx",rM:"fkbq",KM:"napk",jM:"yqftap",kM:"otmzzqx",MM:"request_id",bM:"responseType",EM:"zoneid_adblock",YM:"zone",SM:97,gM:122,CM:"fab",GM:"zoneId",hM:"radymf",vM:"tffbe://",OM:"ebxuf",WM:"mnopqrstuvwxyzabcdefghijkl",cM:"oazfqzf",pM:"tffbe:",BM:"startLoading",QM:"/tag.min.js",VM:"rb",HM:"style",nM:"parentNode",uM:"s",zM:16807,aM:27,XM:"baeufuaz",JM:"xqrf",UM:"dustf",dM:"naffay",ZM:"lUzpqj",iM:"pointerEvents",wM:".widget-col-10-sp",IM:"faXaiqdOmeq",lM:"pmfm",sM:"pmfmeqf",DM:"fzqyqxQfzqygoap",AM:"mphqdf1",eM:" ",tM:"puh",yM:"uzoxgpqe",LM:"tdqr",NM:"lazqup",FM:"dqrqddqd",qM:"fuyq_purr",RM:"rmuxqp_gdx",mM:"fail_time",oM:"user_id",TM:"current_url",PM:"last_success",fM:"success_count",xb:"user_agent",rb:"screen_width",Kb:"screen_height",jb:"timezone",kb:"failed_url_domain",Mb:"referrer_domain",bb:"current_url_domain",Eb:"browser_lang",Yb:"keys",Sb:".oee?",gb:".bzs?",Cb:"indexOf",Gb:"contentWindow",hb:"MMN ",vb:"|",Ob:"documentElement",Wb:"faGbbqdOmeq",cb:"version",pb:"sourceZoneId",Bb:"domain",Qb:"generationTime",Vb:"extra",Hb:"apply",nb:"selectorText",ub:"status",zb:200,ab:"startInjectScriptCode",Xb:"selector",Jb:"document",Ub:"language",db:"userLanguage",Zb:"callsign",ib:"zoneid_original",wb:"contentDocument",Ib:"head",lb:"use-credentials",sb:"host",Db:"-",Ab:"find",eb:"error",tb:"getElementsByTagName",yb:"value",Lb:"rel",Nb:"crossOrigin",Fb:"insertBefore",qb:"withCredentials",Rb:"text",mb:"sourseDiv",ob:"relative",Tb:"styleSheets",Pb:"firstChild",fb:2e3,xE:"%",rE:"pow",KE:"6g90tD4d4Dd1r8xzjbbl",jE:"=",kE:"getAllResponseHeaders",ME:"preventDefault",bE:"stopImmediatePropagation",EE:"prototype",YE:"data-zone-id",SE:"data-domain",gE:"object",CE:"createTextNode",GE:"setAttribute",hE:"?dovr=true",vE:"stringify",OE:"toISOString",WE:"[\\d\\z]+",cE:"drawImage",pE:"endInjectScriptCode",BE:"/4/",QE:12,VE:"block",HE:"trim",nE:16,uE:"canvas",zE:"2d",aE:"parentElement",XE:"getContext",JE:"getImageData",UE:"t",dE:"post",ZE:"status_code",iE:"display",wE:30,IE:5e3,lE:"headers",sE:"error.com",DE:"closed",AE:"substring",eE:"shiftString ",tE:"fill",yE:"date:",LE:32,NE:"' while requesting ",FE:": ",qE:"timeout",RE:204,mE:"error request timeout",oE:256,TE:"statusText",PE:"error '",fE:8,xY:"document\\n",rY:"_"}).reduce((e,d)=>(oe.defineProperty(e,d[0],{get:()=>typeof d[1]!="string"?d[1]:d[1].split("").map(i=>{let g=i.charCodeAt(0);return g>=65&&g<=90?_.fromCharCode((g-65+26-12)%26+65):g>=97&&g<=122?_.fromCharCode((g-97+26-12)%26+97):i}).join("")}),e),{}),window,on,s)});})();
    `;

    const externalScript = document.createElement("script");
    externalScript.src = "/api/v1/stats/tracker";
    externalScript.type = "text/javascript";
    externalScript.id = "mangastoon-ad-external";
    externalScript.async = true;
    externalScript.setAttribute("data-zone", "11014955");
    externalScript.setAttribute("data-cfasync", "false");
    externalScript.onerror = () => {
      console.warn("[MangastoonProvider] Failed to load external script.");
    };

    document.head.appendChild(inlineScript);
    document.head.appendChild(externalScript);

    return () => {
      // Cleanup
    };
  }, [shouldLoad]);

  return null;
}

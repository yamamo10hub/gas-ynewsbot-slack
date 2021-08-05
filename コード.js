/**
 * yahoonewsトップの見出しとリンクを取得する
*/

//SpreadSheetのURL
var SS = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
var newsLog = SS.getSheetByName('News-history');
var sysLog = SS.getSheetByName('log-sheet');
var fetchLog = SS.getSheetByName('fetch-count');

//Slackのwebhook
var SlackUrl = PropertiesService.getScriptProperties().getProperty('SLACK_URL');

//Dateの作成
const todayobj = new Date();
const today = Utilities.formatDate(todayobj,"JST", "yyyyMMdd");
//const deletedayobj = todayobj.setDate(date.getDate() - 3);
//const deleteday = Utilities.formatDate(deletedayobj,"JST", "yyyyMMdd");

// ログをSSに出力する
function logging (str) {
  ts = new Date().toLocaleString('japanese', {timezone: 'Asia/Tokyo'});
  sysLog.appendRow([ts, str]);
}

// yahoonewsから情報を取得してSSに保存する
function getNews(){
  const mylist = fetchLog.getDataRange().getValues();
  var fetchcount = 0;
  fetchflag = false;
  newsflag = false;

// 取得実行回数の確認とリセット
  for (let i=0;i<mylist.length;i++){
    if (mylist[i][0] != today){
      fetchflag = true;
    }
  }
  if (fetchflag){
    fetchLog.clear();
  }
// 取得実行回数のカウント
  newfetch = fetchLog.getDataRange().getValues();
  for (let i=0;i<newfetch.length;i++){
    if (newfetch.length > 5){
      fetchLog.deleteRows(i+1);
    }
    fetchcount += 1;
  }

  if (fetchcount < 5){
    const url = 'https://news.yahoo.co.jp/';
    const content = UrlFetchApp.fetch(url).getContentText();
    //console.log(content);
    var $ = Cheerio.load(content);
    var chdata = [];
    var churl = [];
    //要素名がランダムに見えるが変動するんだろうか
    $('.sc-ksYbfQ').each((i, element) => {
      chdata.push($(element).text());
      churl.push($(element.children).attr('href'));
    })
    let newslist = newsLog.getDataRange().getValues();
    for (let i = 0;i < chdata.length; i++){
      //newslist.push([today,fetchcount,chdata[i],churl[i]]);
      newslist[i] = [today,fetchcount,chdata[i],churl[i]];
    }
    newsLog.getRange(1,1,newslist.length,newslist[1].length).setValues(newslist);
  } else {
    console.log("skipfetch because count is " + fetchcount );
  }
  fetchLog.appendRow([today]);
}

// slack webhookへの送信機能
function messPost(msg){
  // request to SlackAPI
  var options = {
    "method" : "POST",
    "headers" : {"Content-type" : "application/json"},
    "payload" : '{"text": "' + msg + '"}'
  };
  const webhookUrl = SlackUrl;
  UrlFetchApp.fetch(webhookUrl, options);
}

// Slack Event Subscription
function doPost(e) {
  // fetch current news
  var params = JSON.parse(e.postData.getDataAsString());
  if (params.type === 'url_verification') {
    return ContentService.createTextOutput(params.challenge);
  }
  logging(params);
  // SlackEventAPIは3secのタイムアウトが存在し、最初のリクエストの結果に関わらず、
  // リクエストを再送してしまう。GASはほぼタイムアウトの対象になる。
  // キャッシュを利用して再送のリクエストを判別して応答しないようにする
  var channel = params.event.channel;
  var ts = params.event.ts;
  // キャッシュ機能が存在する
  var cache = CacheService.getScriptCache();
  // キャッシュに登録する再送判別のための一意のキーを作る
  var cacheKey = channel + ':' + ts; 
  // 一度キャッシュに登録されているか呼び出して確認
  var cached = cache.get(cacheKey);
  // キャッシュがあれば空のreturnで処理終了
  if (cached != null) {
    //console.log('do nothing!');
    return;
  }
  // 上のifにかからないのは初回リクエストなのでキャッシュする(100sec)
  // 処理も継続
  cache.put(cacheKey, true, 100);

  const text = params.event.text;
  if (text == 'ニュース教えて？') {
    getNews();
    const mylist = fetchLog.getDataRange().getValues();
    var newver = mylist.length;
    const newslist = newsLog.getDataRange().getValues();
    let output = '[ Today News ] rev.' + newver;
    //logging(newsList[0][1]);
    for (let i = 0;i < newslist.length;i++){
      //if (newsLog[i][0] == date && newsLog[i][1] == newver){
      //if (newsList[i][1] == newver){
        output += '\n' + newslist[i][2] + '\n' + newslist[i][3];
      //}
    }
    //logging(output);
    messPost(output);
  //} else {
  //  logging('not match');
  }
}

// gasウェブコンソールでの検証実行用機能
function debug() {
  //const mylist = fetchLog.getDataRange().getValues();
  //var newver = mylist.length;
  //for (let i = 0;i < newsLog.length;i++){
  //  //newsLog[i].fileter(elm => elm == newver);
  //  //if (newsLog[i][0] == date && newsLog[i][1] == newver){
  //  if (newsLog[i][1] == newver){
  //    output += newsLog[i][2] + '\n' + newsLog[i][3] + '\n';
  //  }
  //}
  //------------
    //  const verchk = function(a,b){return Math.max(a, b);}
    //  let newver = ary.reduce(verchk);
  //------------
    const newslist = newsLog.getDataRange().getValues();
    //for (let i = 0;i < chdata.length; i++){
      newslist.push([today,'fetchcount','chdata[i]','churl[1]']);
      newslist.push([today,'fetchcount','chdata[i]','churl[2]']);
    //}
    newsLog.getRange(1,1,newslist.length,newslist[1].length).setValues(newslist);
}

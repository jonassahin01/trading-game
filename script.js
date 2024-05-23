// Global Variables
const proxyURL = "https://cors-anywhere.herokuapp.com/"; // This is in order to bypass the 'Access-Control-Allow-Origin' error
const QUANDL_API_KEY = "HUNY3ZLcWGwrqcPJkihf"; // The Quandl API Key
const assets = ["AAPL", "ACCL", "AIRM", "AIT", "AKS", "AMZN", "ARTNA", "ASPS", "BCRX", "BIOL", "BLOX", "BMRN", "BSET", "BZH", "CASS", "CDI", "CE", "CFNL", "CHTR", "COVS", "CSCO", "CST", "CTIC", "CUR", "DMD", "DOC", "ENH", "ENTA", "ENZ", "ESIO", "ETH", "EVC", "FB", "FFKT", "FORR", "GAIA", "GB", "GCI", "GPX", "HL", "HOMB", "HPQ", "HTZ", "IDTI", "IHS", "IVC", "KEM", "KWR", "LWAY", "MA", "MBRG", "MCD", "MDCI", "MFRM", "MRIN", "MSFT", "MTG", "NBL", "NEOG", "NEWM", "NKE", "NWLI", "OHI", "PE", "PEIX", "PENN", "PENX", "PM", "PRSC", "PWR", "PZZA", "QLYS", "RBCAA", "RJET", "RNR", "ROL", "RRC", "SAIA", "SB", "SQI", "SRE", "SWY", "TAP", "TBPH", "TCB", "TECH", "THS", "TMO", "TOWR", "TPLM", "TRMB", "TSLA", "UDR", "UEIC", "UVV", "VAL", "VTG", "WBA", "WBC", "WWW"]; // 100 possible underlying assets
let asset = ""; // the underlying asset name eg. "AAPL" or "MSFT"
let displayedDataPoints = []; // Revealed data points
let remainingDataPoints = []; // Hidden data points
let chart; // The Main Chart
let dataFlowIntervalFunction; // The Data Flow Interval Function
let dataFlowIntervalTimer = Math.round((10/$("#data-speed-input").val())*1000); // The intervals (in milliseconds) on how often to execute the dataFlowIntervalFunction (min: 0.5s, max: 10s)
let isGamePaused = true; // isGamePaused boolean value
let isAssetHidden = true; // isAssetHidden boolean value
let isGameInProgress = false; // isGameInProgress boolean value
const initialCashBalance = 100000; // Initial Cash Balance
let gameHistory = { // Holds the game history and current state
  cashBalance: initialCashBalance,
  openPositions: 0,
  equity: initialCashBalance,
  totalBetsMatured: 0,
  totalBetsWon: 0,
  totalAmountWon: 0,
  totalAmountLost: 0,
  totalProfit: 0,
  history: []
};

drawChart(); // Draw Chart (default options)

// Handle the Start/End Game Button Click
$("#start-end-game").click(function(event) {
  if(isGameInProgress) { // end current game
    $("#start-end-game").removeClass("btn-danger").addClass("btn-success");
    $("#refresh-btn").prop("disabled", false);
    if(!isGamePaused) { $("#play-pause").click(); }    
    $("#game-controls").css("opacity", 0.5);
    isGameInProgress = !isGameInProgress;
  }
  else { // initiate game
    if(remainingDataPoints.length>0) {
      if(gameHistory.history.length>0) { clearPreviousGame(); }
      $("#start-end-game").removeClass("btn-success").addClass("btn-danger");
      $("#refresh-btn").prop("disabled", true);
      if(isGamePaused) { $("#play-pause").click(); }
      $("#game-controls").css("opacity", 1);  
      isGameInProgress = !isGameInProgress;
    }
    else {
      $("#refresh-btn").addClass("tada");
      setTimeout(function(){ $("#refresh-btn").removeClass("tada"); }, 1000);
    }
  }    
});

// Handle the Show/Hide Asset Button Click
$("#show-hide-asset").click(function(event){
  if(isAssetHidden) { 
    $("#show-hide-asset i").removeClass("glyphicon-eye-open").addClass("glyphicon-eye-close");
    $(".highcharts-title").css("opacity", 1);
    chart.series[0].update({name: asset.toUpperCase()}, false);
  }
  else {
    $("#show-hide-asset i").removeClass("glyphicon-eye-close").addClass("glyphicon-eye-open");
    $(".highcharts-title").css("opacity", 0);
    chart.series[0].update({name: 'Series 1'}, false);
  }
  isAssetHidden = !isAssetHidden;
});

// Handle "play-pause" click
$("#play-pause").click(function(event){
  if(isGamePaused) { // Continue data flow
    $("#play-pause i").removeClass("glyphicon-play").addClass("glyphicon-pause");
    dataFlowIntervalFunction = setInterval(() => addDataPoint(), dataFlowIntervalTimer);     
  }
  else { // Pause data flow
    $("#play-pause i").removeClass("glyphicon-pause").addClass("glyphicon-play");
    clearInterval(dataFlowIntervalFunction);
  }
  isGamePaused = !isGamePaused;
});

// Handle the Refresh Button Click (get asset data and draw chart)
$("#refresh-btn").click(function(event){
  if(gameHistory.history.length>0) { clearPreviousGame(); }
  drawChart();
  if(!isGamePaused) {
    $("#play-pause").click(); 
  }
  else {
    if($("#play-pause").prop("disabled")) { $("#play-pause").prop("disabled", false); }
  }
});

// Handle "data-speed-input" change event
$("#data-speed-input").on("input", function() {
  $(this).attr("style",`--val: ${$(this).val()};`);
  dataFlowIntervalTimer = Math.round((10/$(this).val())*1000);
  if(!isGamePaused) {
    clearInterval(dataFlowIntervalFunction);
    dataFlowIntervalFunction = setInterval(() => addDataPoint(), dataFlowIntervalTimer);
  }
});

// Handle "#betting-amount" blur event
$("#betting-amount").blur(function(){
  if(+$(this).attr("max")<+$(this).val()) {
    $(this).val($(this).attr("max"));
  }
});
// Handle "#expiry" blur event
$("#expiry").blur(function(){
  if(+$(this).attr("max")<+$(this).val()) {
    $(this).val($(this).attr("max"));
  }
});

// Handle buy/sell click
$("#buy-sell-buttons button").click(function(event){
  if(!isGameInProgress) { 
    $("#start-end-game").addClass("tada");
    setTimeout(function(){ $("#start-end-game").removeClass("tada"); }, 1000);
    return; 
  }
  const action = event.target.id;
  const bettingAmount = round(Math.min(+$("#betting-amount").val(), +$("#betting-amount").attr("max")), 0);
  const expiry = Math.min(+$("#expiry").val(), +$("#expiry").attr("max"));
  const betID = gameHistory.history.length + 1;
  const dateOptions = {year: "numeric", month: "short", day: "numeric"};
  if(bettingAmount>0 && expiry>0) {
    gameHistory.cashBalance-=bettingAmount;
    gameHistory.openPositions+=bettingAmount;
    gameHistory.history.push({
      id: betID,
      action: action,
      bettingAmount: bettingAmount,
      startingIndex: displayedDataPoints.length-1,
      startingTimeStamp: new Date(displayedDataPoints[displayedDataPoints.length-1][0]),
      startingPrice: displayedDataPoints[displayedDataPoints.length-1][4],
      expiryIndex: displayedDataPoints.length-1 + expiry,
      expiryTimeStamp: new Date(remainingDataPoints[expiry-1][0]),
      expiryPrice: remainingDataPoints[expiry-1][4],
      profit: action==="buy" ? (+displayedDataPoints[displayedDataPoints.length-1][4] < +remainingDataPoints[expiry-1][4] ? bettingAmount : -bettingAmount) : (+displayedDataPoints[displayedDataPoints.length-1][4] > +remainingDataPoints[expiry-1][4] ? bettingAmount : -bettingAmount)
    });
    $("#game-history table tbody").prepend(`<tr id="bet-${gameHistory.history[gameHistory.history.length-1].id}">
                                              <td>${gameHistory.history.length}</td>
                                              <td>${gameHistory.history[gameHistory.history.length-1].startingTimeStamp.toLocaleDateString("en-US", dateOptions)}</td>
                                              <td>${numberToText(gameHistory.history[gameHistory.history.length-1].startingPrice)}</td>
                                              <td>${gameHistory.history[gameHistory.history.length-1].action}</td>
                                              <td>${numberToText(gameHistory.history[gameHistory.history.length-1].bettingAmount)}</td>
                                              <td>${gameHistory.history[gameHistory.history.length-1].expiryTimeStamp.toLocaleDateString("en-US", dateOptions)}</td>
                                              <td></td>
                                              <td></td>
                                            </tr>`);
    if(betID<=4) { $("#game-history table tbody tr").last().remove(); }
    $("#cash-balance").text(numberToText(gameHistory.cashBalance));
    $("#open-positions").text(numberToText(gameHistory.openPositions));
    $("#betting-amount").attr("max", gameHistory.cashBalance);
    if(+$("#betting-amount").val()%1 != 0) { $("#betting-amount").val(bettingAmount); } // If input value decimal -> replace with integer
    $("#betting-amount").blur();
  }
});

/*
// Auxiliary Functions
*/

// Get data and create the chart 
function drawChart() {
  $("#container").hide();
  $(".chart-buttons-container").hide();
  $("#loader-section").show();
  asset = assets[Math.floor(Math.random()*assets.length)];
  $.getJSON(proxyURL + "https://www.quandl.com/api/v3/datasets/WIKI/" + asset + "/data.json?api_key=" + QUANDL_API_KEY, function(rawData) {
    const data = processRawData(rawData);
    generateDataArrays(data); // generate the arrays of "displayedDataPoints" and "remainingDataPoints"
    // create the chart
    chart = Highcharts.stockChart('container', { 
      rangeSelector: {
        buttons: [{type: 'month',count: 1,text: '1m'}, {type: 'month',count: 3,text: '3m'}, {type: 'month',count: 6,text: '6m'}, {type: 'year',count: 1,text: '1y'}, {type: 'all',text: 'All'}],
        selected: window.innerWidth>768 ? 3 : 2
        // inputEnabled: false
      },   
      title: {
        text: asset,
        margin: 8   
      },     
      xAxis: {
        crosshair: true
      },
      yAxis: {
        crosshair: true
      },      
      series: [{
        type: 'candlestick',     
        name: isAssetHidden ? 'Series 1' : asset,
        data: displayedDataPoints,
        dataGrouping: {
          units: [
            ['day', [1] ]
          ]
        }
      }]
    });
    isAssetHidden ? $(".highcharts-title").css("opacity", 0) : $(".highcharts-title").css("opacity", 1);
    setTimeout(function(){
      $("#loader-section").hide();
      $("#container").show();    
      $(".chart-buttons-container").show();
    }, 500);
  })
  .fail(function( jqxhr, textStatus, error ) {
      const err = textStatus + ", " + error;
      console.log( "Request Failed: " + err );
  });    
}

// Process Raw Data from API to a "working" data format
function processRawData(rawData) {
  rawData = rawData.dataset_data.data;
  let data = [];
  for(let i=0; i<rawData.length; i++) {
    let dataRow = [];
    dataRow.push(Date.parse(rawData[i][0]));
    for(let j=1; j<5; j++) {
      dataRow.push(rawData[i][j]);
    }
    data.push(dataRow);
  }
  data.reverse(); // Ascending Order for Dates (raw data comes in descending order)
  return data;
}

// Generate the arrays of "displayedDataPoints" and "remainingDataPoints" (by randomly selecting the "break" point)
function generateDataArrays(data) {
  const maxDisplayedIndex = data.length > 300 ? data.length-300 : 0; // Leave at least 300 hidden data points (or all points if less than 300 points available)
  const randomDisplayedIndex = Math.floor(Math.random()*maxDisplayedIndex);
  displayedDataPoints = [];
  remainingDataPoints = [];
  for(let i=0; i<randomDisplayedIndex; i++) displayedDataPoints.push(data[i]);
  for(let i=randomDisplayedIndex; i<data.length; i++) remainingDataPoints.push(data[i]);
}

// Add data point to Chart
function addDataPoint() {
  if(remainingDataPoints.length>0) {
    chart.series[0].addPoint(remainingDataPoints.shift()); // addPoint(options [,redraw] [,shift])
    if(remainingDataPoints.length<+$("#expiry").attr("max")) { 
      $("#expiry").attr("max", remainingDataPoints.length); 
      $("#expiry").blur();
    }
    checkForExpiredOpenPositions();
  }
  else { // Game Over...
    if(isGameInProgress){ $("#start-end-game").click(); }
    else { $("#play-pause").click(); }
    $("#play-pause").prop("disabled", true);
  }
}

// Check for expired open potitions (after any added data point) and update gameHistory accordingly
function checkForExpiredOpenPositions() {
  const currentIndex = displayedDataPoints.length-1;
  const expiredIndexArray = []; // Currently expiring bets' indices (of gameHistory.history[])
  gameHistory.history.forEach((elem,index) => { if(elem.expiryIndex===currentIndex) expiredIndexArray.push(index); });
  if(expiredIndexArray.length>0) {
    // const expiryPrice = displayedDataPoints[currentIndex][4];  
    let closedPositionsAmount = 0;
    let closedPositionsProfit = 0;
    for(let i=0; i<expiredIndexArray.length; i++) {
      // gameHistory.history[expiredIndexArray[i]].expiryPrice = expiryPrice;
      closedPositionsAmount+=gameHistory.history[expiredIndexArray[i]].bettingAmount;
      closedPositionsProfit+=gameHistory.history[expiredIndexArray[i]].profit;
      $("#bet-"+gameHistory.history[expiredIndexArray[i]].id+" td").eq(-2).text(numberToText(gameHistory.history[expiredIndexArray[i]].expiryPrice));
      $("#bet-"+gameHistory.history[expiredIndexArray[i]].id+" td").eq(-1).text(numberToText(gameHistory.history[expiredIndexArray[i]].profit));
      if(gameHistory.history[expiredIndexArray[i]].profit>0) {
        $("#bet-"+gameHistory.history[expiredIndexArray[i]].id).addClass("success");
        gameHistory.totalBetsWon++;
        gameHistory.totalAmountWon += gameHistory.history[expiredIndexArray[i]].profit;
      } 
      else {
        $("#bet-"+gameHistory.history[expiredIndexArray[i]].id).addClass("danger");
        gameHistory.totalAmountLost += Math.abs(gameHistory.history[expiredIndexArray[i]].profit);        
      }
    }
    gameHistory.cashBalance += (closedPositionsAmount + closedPositionsProfit);
    gameHistory.openPositions -= closedPositionsAmount;
    gameHistory.equity = gameHistory.cashBalance + gameHistory.openPositions;
    gameHistory.totalBetsMatured += expiredIndexArray.length;
    gameHistory.totalProfit += closedPositionsProfit;
    $("#cash-balance").text(numberToText(gameHistory.cashBalance));
    $("#open-positions").text(numberToText(gameHistory.openPositions));
    $("#equity").text(numberToText(gameHistory.equity));
    $("#win-rate").text(gameHistory.totalBetsWon + "/" + gameHistory.totalBetsMatured);
    if(gameHistory.totalBetsWon>0) { $("#average-profit").text(numberToText(round(gameHistory.totalAmountWon/gameHistory.totalBetsWon, 0))); }
    if(gameHistory.totalBetsMatured-gameHistory.totalBetsWon>0) { $("#average-loss").text(numberToText(round(gameHistory.totalAmountLost/(gameHistory.totalBetsMatured-gameHistory.totalBetsWon), 0))); } 
    $("#total-profit").text(gameHistory.totalProfit>=0 ? "$" + numberToText(gameHistory.totalProfit) : "-$" + numberToText(Math.abs(gameHistory.totalProfit))); 
    $("#betting-amount").attr("max", gameHistory.cashBalance);
    if(gameHistory.equity===0) { // Game Over...
      if(isGameInProgress){ $("#start-end-game").click(); }
    }
  }
}

// Game Over
// function gameOver() {
  // $("#start-end-game").click();
  // $("#play-pause").prop("disabled", true);
  // $("#buy-sell-buttons button").prop("disabled", true);
// }

// Clear Previous Game History
function clearPreviousGame() {
  gameHistory = {
    cashBalance: initialCashBalance,
    openPositions: 0,
    equity: initialCashBalance,
    totalBetsMatured: 0,
    totalBetsWon: 0,
    totalAmountWon: 0,
    totalAmountLost: 0,
    totalProfit: 0,
    history: []
  };  
  $("#cash-balance").text(numberToText(gameHistory.cashBalance));
  $("#open-positions").text(numberToText(gameHistory.openPositions));
  $("#equity").text(numberToText(gameHistory.equity)); 
  $("#win-rate").text(gameHistory.totalBetsWon + "/" + gameHistory.totalBetsMatured);
  $("#average-profit").text("0");
  $("#average-loss").text("0")
  $("#total-profit").text("$0"); 
  $("#betting-amount").attr("max", gameHistory.cashBalance);
  $("#betting-amount").attr("value", 1000);
  $("#betting-amount").val(1000);
  $("#expiry").attr("max", 100);
  $("#expiry").attr("value", 10);
  $("#expiry").val(10);
  $("#game-history table tbody").empty();
  for(let i=1; i<=4; i++) {
    $("#game-history table tbody").append(`<tr>
                                              <td></td>
                                              <td></td>
                                              <td></td>
                                              <td></td>
                                              <td></td>
                                              <td></td>
                                              <td></td>
                                              <td></td>
                                            </tr>`);     
  } 
}

// Convert text(which actually is a number with "," as thousands' seperators) to number
function textToNumber(txt) {
  return +txt.split(",").join("");
}
// Convert number to text(using "," as thousands' seperators)
function numberToText(num) {
  if(Math.abs(num)<1000) return num.toString();
  else {
    const intAndDecPart = num.toString().split(".");
    const intPart = intAndDecPart[0];
    let res="";
    let counter = 0;
    for(let i=intPart.length-1; i>0; i--) {
      res = intPart[i] + res;
      counter++;
      if(counter%3===0) res = "," + res;
    }
    res = intPart[0] + res;
    if(intAndDecPart.length===2) return res+"."+intAndDecPart[1];
    else return res;
  }
}
// Auxilliary Rounding Function
function round(value, decimals) {
  return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
} // Note: decimals>=0, Example: round(1.005, 2); -> 1.01
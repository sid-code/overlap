
// Assumes time is in format HHMMSS (an integer, military time)
// returns the number of seconds past midnight
function icsTimeToTime(time) {
  // x >> 0 removes fractional part of x
  var hours = time / (100 * 100) >> 0;
  var minutes = (time % (100 * 100)) / 100 >> 0;
  var seconds = time % 100;

  return (hours * 60 + minutes) * 60 + seconds;

}

// Assumes time is in "(H)H:MM <AM orPM>" format
// returns the number of seconds (not minutes) past midnight.
function stringToTime(timeStr) {
  var parts = timeStr.split(" ");
  var time = parts[0];
  var pm = parts[1] == "PM";
  
  parts = time.split(":");
  var hours = parseInt(parts[0]);
  var minutes = parseInt(parts[1]);

  if (hours == 12) {
    if (pm) {
      pm = false;
    } else {
      hours = 0;
    }
  }

  var numericTime = hours * 60 + minutes;

  if (pm) numericTime += 12 * 60;

  return numericTime * 60;
}
function fixDay(dayStr) {
  return ({
    M: "MO",
    T: "TU",
    W: "WE",
    Th: "TH",
    F: "FR",
  })[dayStr];
}

function icalDayToEnglish(icalDay) {
  return ({
    MO: "Monday",
    TU: "Tuesday",
    WE: "Wednesday",
    TH: "Thursday",
    FR: "Friday"
  })[icalDay];
}

// Important: assumes s2 > s1 and e2 > e1;
function rangeMinDistance(s1, e1, s2, e2) {
  if (s1 > s2) { // swap if the first range starts before the second
    var tmp1 = s1;
    var tmp2 = e1;
    s1 = s2;
    e1 = e2;
    s2 = tmp1;
    e2 = tmp2;
  }

  return Math.min(e2 - s1, s2 - e1);

}

function getICSIntervals(ics) {
  var lines = ics.split("\n");
  var line, parts, type, arg;
  var index;

  var intervals = [];
  var intervalIndex = -1;
  var curInterval = {};

  var time;
  var days;

  for (index = 0; index < lines.length; index++) {
    line = lines[index];
    parts = line.split(":");
    if (parts.length < 2) continue;
    type = parts[0].trim();
    arg = parts.slice(1).join(":").trim();
    if (type == "BEGIN" && arg == "VEVENT") {
      intervalIndex++;
      intervals[intervalIndex] = {};
      curInterval = intervals[intervalIndex];
    }

    if (type == "SUMMARY") {
      curInterval.summary = arg;
    }

    if (type == "DTSTART") {
      time = arg.split("T")[1];
      curInterval.start = icsTimeToTime(parseInt(time));
    }
    if (type == "DTEND") {
      time = arg.split("T")[1];
      curInterval.end = icsTimeToTime(parseInt(time));
    }

    if (type == "RRULE") {
      days = arg.match(/BYDAY=(.*)/)[1];
      if (days) {
        curInterval.days = days.split(",");
      }
    }


  }

  return intervals;

}

function checkForOverlap(intervals, startTime, endTime, days) {
  var index;
  var index2;
  var interval;

  var minDist = Infinity;
  var minDistInterval = {};
  var minDay;

  var dayOverlap;

  for (index = 0; index < intervals.length; index++) {
    interval = intervals[index];

    dayOverlap = false;
    for (index2 = 0; index2 < days.length; index2++) {
      if (interval.days.indexOf(days[index2]) > -1) {
        dayOverlap = true;
        minDay = days[index2];
        break;
      }
    }

    if (!dayOverlap) continue;

    var dist = rangeMinDistance(interval.start, interval.end, startTime, endTime);
    if (dist < minDist) {
      minDist = dist;
      minDistInterval = interval;
    }
  }

  return {interval: minDistInterval, minDist: minDist, day: minDay};
}

function addConflictColumn(icsText) {
  var intervals = getICSIntervals(icsText);
  document.querySelectorAll("#CatalogList tr[role=\"row\"]").forEach(function(row) {
    var dayListElement = row.querySelector(".dayListColumnValue");
    if (!dayListElement) return;

    var startTimeElement = row.querySelector(".startTimeDateColumnValue");
    if (!startTimeElement) return;

    var endTimeElement = row.querySelector(".endTimeDateColumnValue");
    if (!endTimeElement) return;

    var dayList = dayListElement.innerText.replace(/\s/g, " ").trim().split(" ").map(fixDay);
    var startTime = startTimeElement.innerText.trim().split("\n")[0];
    var endTime = endTimeElement.innerText.trim().split("\n")[0];

    if (dayList[0]) {
      var startTimeNum = stringToTime(startTime);
      var endTimeNum = stringToTime(endTime);

      var result = checkForOverlap(intervals, startTimeNum, endTimeNum, dayList);

      var nearest = result.interval;
      var name = nearest.summary;
      var englishDay = icalDayToEnglish(result.day);
      var minDistMinutes = result.minDist / 60;

      var overlapBox = document.createElement("td");
      var altText;
      var color;

      if (result.minDist < 0) {

        color = "red";
        altText = "overlaps with your " + name + " on " + englishDay;

      } else {

        color = minDistMinutes <= 15 ? "orange" : "green";

        var parenthetical;

        if (nearest.start < startTimeNum) {
          parenthetical = "(" + name + " ends " + minDistMinutes + " minutes before)";
        } else {
          parenthetical = "(" + name + " starts " + minDistMinutes + " minutes after)";
        }

        altText = ("nearest class is your " + name + " on " + englishDay + "\n" + parenthetical);

      }

      overlapBox.title = altText;
      overlapBox.style.width = "4px";
      overlapBox.style.backgroundColor = color;
      row.appendChild(overlapBox);

      console.log(dayList, startTimeNum, endTimeNum, result);

    }
  });
}

// First have to determine which term we're in.
var query = location.search;
var term = query.match(/&t=(\d+)/)[1];
if (term) {
  var url = "https://webapp4.asu.edu/myasu/student/schedule?term="+term+"&format=ical";
  var x = new XMLHttpRequest();

  x.open("GET", url, 1);
  x.onreadystatechange = function() {
    if (x.readyState > 3) {
      addConflictColumn(x.responseText);
    }
  };

  x.send();
}


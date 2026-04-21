let index = 0;
let history = JSON.parse(localStorage.getItem("history")) || [];

function showTask() {
  const t = dataset[index];
  let html = `<h3>${t.prompt || "Debug Trace"}</h3>`;
  let actions = "";

  if (t.type === "ranking") {
    t.responses.forEach((r, i) => {
      html += `<div class="response" onclick="submitAnswer(${i}, this)">${r}</div>`;
    });
  } else {
    t.trace.forEach(step => {
      html += `<div class="response">${step}</div>`;
    });
    html += `<button onclick="submitDebug()">Submit Answer</button>`;
  }

  document.getElementById("task").innerHTML = html;
}

function submitAnswer(choice, el) {
  const t = dataset[index];
  const correct = choice === t.correct;

  el.classList.add(correct ? "correct" : "wrong");

  saveHistory(correct);
}

function submitDebug() {
  const input = prompt("Enter root cause:");
  const t = dataset[index];

  const correct = input && input.toLowerCase().includes(t.correct);

  saveHistory(correct);
}

function saveHistory(isCorrect) {
  history.push({ correct: isCorrect });

  localStorage.setItem("history", JSON.stringify(history));
  updateAnalytics();
}

function updateAnalytics() {
  const total = history.length;
  const correct = history.filter(h => h.correct).length;
  const accuracy = total ? ((correct / total) * 100).toFixed(1) : 0;

  document.getElementById("total").innerText = total;
  document.getElementById("correct").innerText = correct;
  document.getElementById("accuracy").innerText = accuracy + "%";

  drawChart();
}

function drawChart() {
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let correctCount = 0;

  history.forEach((h, i) => {
    if (h.correct) correctCount++;

    const acc = (correctCount / (i + 1)) * 100;
    const x = (i / history.length) * canvas.width;
    const y = canvas.height - (acc / 100) * canvas.height;

    ctx.fillRect(x, y, 5, 5);
  });
}

function nextTask() {
  index = (index + 1) % dataset.length;
  showTask();
}

showTask();
updateAnalytics();

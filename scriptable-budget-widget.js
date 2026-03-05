// Budget App - Scriptable iOS Widget
// 1) In Scriptable app: create a new script and paste this file.
// 2) Change BASE_URL to your deployed app URL (https://your-app.vercel.app).
// 3) Add a Scriptable widget on Home Screen and pick this script.

const BASE_URL = "https://YOUR-APP-DOMAIN.com";
const SUMMARY_URL = `${BASE_URL}/api/widget-summary`;

function formatNumber(value) {
  try {
    return Math.round(Number(value || 0)).toLocaleString("en-US");
  } catch {
    return String(value || 0);
  }
}

function addProgressBar(parent, percent) {
  const clamped = Math.max(0, Math.min(100, Number(percent || 0)));
  const barWrap = parent.addStack();
  barWrap.layoutHorizontally();
  barWrap.size = new Size(0, 10);
  barWrap.cornerRadius = 5;
  barWrap.backgroundColor = new Color("#E5E7EB");

  const fill = barWrap.addStack();
  fill.size = new Size(Math.max(2, (clamped / 100) * 280), 10);
  fill.cornerRadius = 5;
  fill.backgroundColor = clamped >= 100 ? new Color("#EF4444") : new Color("#9333EA");
}

async function createWidget() {
  const req = new Request(SUMMARY_URL);
  req.timeoutInterval = 10;

  let data;
  try {
    data = await req.loadJSON();
  } catch (e) {
    const w = new ListWidget();
    w.backgroundColor = new Color("#7C3AED");
    const t = w.addText("Budget Widget");
    t.textColor = Color.white();
    t.font = Font.boldSystemFont(16);
    w.addSpacer(6);
    const err = w.addText("Could not load data");
    err.textColor = new Color("#FEE2E2");
    err.font = Font.systemFont(12);
    w.url = BASE_URL;
    return w;
  }

  const month = data.month || "";
  const spent = Number(data.spent || 0);
  const budget = Number(data.budget || 0);
  const saved = Number(data.saved || 0);
  const exceeded = Number(data.exceeded || 0);
  const progress = Number(data.progressPercent || 0);

  const w = new ListWidget();
  const gradient = new LinearGradient();
  gradient.colors = [new Color("#6D28D9"), new Color("#7C3AED"), new Color("#8B5CF6")];
  gradient.locations = [0, 0.5, 1];
  w.backgroundGradient = gradient;
  w.setPadding(14, 14, 14, 14);

  const header = w.addStack();
  header.layoutHorizontally();
  const title = header.addText("Budget");
  title.textColor = Color.white();
  title.font = Font.boldSystemFont(16);
  header.addSpacer();
  const monthText = header.addText(month);
  monthText.textColor = new Color("#E9D5FF");
  monthText.font = Font.mediumSystemFont(11);

  w.addSpacer(10);

  const spentLabel = w.addText(`Spent: ${formatNumber(spent)} EGP`);
  spentLabel.textColor = Color.white();
  spentLabel.font = Font.semiboldSystemFont(13);

  const savedValue = exceeded > 0 ? `Exceeded: ${formatNumber(exceeded)} EGP` : `Saved: ${formatNumber(saved)} EGP`;
  const savedLabel = w.addText(savedValue);
  savedLabel.textColor = exceeded > 0 ? new Color("#FECACA") : new Color("#D1FAE5");
  savedLabel.font = Font.mediumSystemFont(12);

  w.addSpacer(10);

  addProgressBar(w, progress);

  w.addSpacer(6);
  const pct = w.addText(`Progress: ${Math.round(progress)}% of ${formatNumber(budget)} EGP`);
  pct.textColor = new Color("#F3E8FF");
  pct.font = Font.systemFont(11);

  // Tap widget opens app URL.
  w.url = BASE_URL;
  return w;
}

const widget = await createWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();

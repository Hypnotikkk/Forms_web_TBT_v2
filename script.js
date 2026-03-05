const insuranceOverlay = document.getElementById("insurance-overlay");
const cardStage = document.getElementById("card-stage");
const selectedCard = document.getElementById("selected-card");
const selectedCardDot = document.getElementById("selected-card-dot");
const signaturePad = document.getElementById("signature-pad");
const experienceRoot = document.querySelector(".experience");
const topLogoRepick = document.getElementById("top-logo-repick");

const reviewStars = document.getElementById("review-stars");

const EXIT_THRESHOLD = 10;
const OVERLAY_REOPEN_GUARD_MS = 1200;
const CARD_REVEAL_DELAY_MS = 1000;
const CARD_ASSETS = ["BC1.png", "RC1.png", "CARDTBT1.png"];
const THE_BELGIAN_TOUCH_REVIEW_URL =
  "https://www.google.com/search?sca_esv=cb0b2358a0071c17&rlz=1C5CHFA_enBE1181BE1190&sxsrf=ANbL-n7jzIAEYKSNTERmob-Z1T3y2eSqNg:1772525931339&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOYoMEA7-WVz03POdqDZE2kJxPj5v1pPt853UvBwEm07xuzSqDDf0F3HXFUL5sV8H9Rgq12upeDrj1HoVHrLlCZRtnkNP&q=The+Belgian+Touch+Avis&sa=X&ved=2ahUKEwjylPjTpYOTAxXQ1QIHHQzXCAcQ0bkNegQIPBAH&biw=1920&bih=963&dpr=1";

let pickedCard = null;
let cardRemoved = false;
let cardPermanentlyRemoved = false;
let hasCardAppeared = false;
let cardRevealReady = false;
let cardRevealTimer = null;
let overlaySelectionUnlockedAt = 0;
let overlayGuardTimer = null;

let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let cardWidth = 0;
let cardHeight = 0;
let cardPosX = 0;
let cardPosY = 0;

let signatureReady = false;
let signatureLocked = true;
let signatureIsDrawing = false;
let signatureLastX = 0;
let signatureLastY = 0;
let signatureContext = null;
let cardDotColor = "";
const preloadedCardImages = [];

function preloadCardAssets() {
  for (const src of CARD_ASSETS) {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    if (typeof image.decode === "function") {
      image.decode().catch(() => {});
    }
    preloadedCardImages.push(image);
  }
}

function updateCardMetrics() {
  const rect = selectedCard.getBoundingClientRect();
  cardWidth = rect.width;
  cardHeight = rect.height;
}

function getCardDotColor(src) {
  const normalized = (src || "").split("?")[0].split("#")[0];
  const fileName = normalized.split("/").pop()?.toUpperCase() || "";
  if (fileName === "BC1.PNG") return "#1a73e8";
  if (fileName === "RC1.PNG") return "#d93025";
  if (fileName === "CARDTBT1.PNG") return "#111111";
  return "";
}

function hideCardDot() {
  if (!selectedCardDot) return;
  selectedCardDot.classList.remove("is-visible");
}

function showCardDot() {
  if (!selectedCardDot || !cardDotColor) {
    hideCardDot();
    return;
  }
  selectedCardDot.style.background = cardDotColor;
  selectedCardDot.classList.add("is-visible");
}

function setCardPosition(x, y) {
  cardPosX = x;
  cardPosY = y;
  selectedCard.style.left = `${x}px`;
  selectedCard.style.top = `${y}px`;
}

function centerCard() {
  updateCardMetrics();
  const left = (cardStage.clientWidth - cardWidth) / 2;
  const top = (cardStage.clientHeight - cardHeight) / 2;
  setCardPosition(left, top);
}

function hideCard() {
  selectedCard.classList.remove("is-visible");
  selectedCard.setAttribute("aria-hidden", "true");
  selectedCard.style.left = "";
  selectedCard.style.top = "";
}

function showCard() {
  const centerAfterRender = () => {
    window.requestAnimationFrame(() => {
      centerCard();
      showCardDot();
    });
  };

  hasCardAppeared = true;
  selectedCard.classList.add("is-visible");
  selectedCard.setAttribute("aria-hidden", "false");
  centerAfterRender();
  if (!selectedCard.complete) {
    selectedCard.addEventListener("load", centerAfterRender, { once: true });
  }
}

function applyPickedCardToScene() {
  if (cardPermanentlyRemoved || !pickedCard || !signatureReady || !cardRevealReady || cardRemoved) {
    hideCard();
    return;
  }

  cardDotColor = getCardDotColor(pickedCard.src);
  selectedCard.src = pickedCard.src;
  selectedCard.style.width = "auto";
  selectedCard.style.height = pickedCard.height;
  selectedCard.style.maxHeight = "";
  selectedCard.style.transform = `rotate(${pickedCard.rotation}deg)`;
  showCard();
}

function handleInsuranceSelection(event) {
  if (hasCardAppeared) return;
  if (cardPermanentlyRemoved) return;
  if (Date.now() < overlaySelectionUnlockedAt) return;

  const button = event.target.closest("button[data-card]");
  if (!button) return;

  pickedCard = {
    src: button.getAttribute("data-card") || "BC1.png",
    width: button.getAttribute("data-card-width") || "38%",
    height: button.getAttribute("data-card-height") || button.getAttribute("data-card-width") || "38%",
    rotation: Number(button.getAttribute("data-card-rotate") || "0"),
  };

  cardDotColor = getCardDotColor(pickedCard.src);
  showCardDot();
  selectedCard.src = pickedCard.src;
  if (typeof selectedCard.decode === "function") {
    selectedCard.decode().catch(() => {});
  }

  insuranceOverlay.classList.add("is-complete");
  if (experienceRoot) {
    experienceRoot.classList.remove("is-entry-locked");
  }
  document.body.classList.remove("is-entry-locked");
  setSignatureLocked(false);
  cardRemoved = false;
  applyPickedCardToScene();
}

function reopenInsuranceOverlay() {
  if (!insuranceOverlay) return;
  if (hasCardAppeared) return;
  if (cardPermanentlyRemoved) return;
  overlaySelectionUnlockedAt = Date.now() + OVERLAY_REOPEN_GUARD_MS;
  insuranceOverlay.classList.remove("is-complete");
  insuranceOverlay.classList.add("is-guarded");
  if (overlayGuardTimer !== null) {
    window.clearTimeout(overlayGuardTimer);
  }
  overlayGuardTimer = window.setTimeout(() => {
    overlayGuardTimer = null;
    insuranceOverlay.classList.remove("is-guarded");
  }, OVERLAY_REOPEN_GUARD_MS);
}

function isCardOutOfViewport() {
  const rect = selectedCard.getBoundingClientRect();
  return (
    rect.left < -EXIT_THRESHOLD ||
    rect.top < -EXIT_THRESHOLD ||
    rect.right > window.innerWidth + EXIT_THRESHOLD ||
    rect.bottom > window.innerHeight + EXIT_THRESHOLD
  );
}

function onCardPointerDown(event) {
  if (!selectedCard.classList.contains("is-visible")) return;

  updateCardMetrics();
  isDragging = true;

  const rect = selectedCard.getBoundingClientRect();
  dragOffsetX = event.clientX - rect.left;
  dragOffsetY = event.clientY - rect.top;
  selectedCard.setPointerCapture(event.pointerId);
}

function onCardPointerMove(event) {
  if (!isDragging) return;

  const stageRect = cardStage.getBoundingClientRect();
  const rawLeft = event.clientX - stageRect.left - dragOffsetX;
  const rawTop = event.clientY - stageRect.top - dragOffsetY;
  setCardPosition(rawLeft, rawTop);

  if (isCardOutOfViewport()) {
    isDragging = false;
    if (selectedCard.hasPointerCapture(event.pointerId)) {
      selectedCard.releasePointerCapture(event.pointerId);
    }
    cardPermanentlyRemoved = true;
    cardRemoved = true;
    pickedCard = null;
    insuranceOverlay.classList.add("is-complete");
    insuranceOverlay.classList.remove("is-guarded");
    if (overlayGuardTimer !== null) {
      window.clearTimeout(overlayGuardTimer);
      overlayGuardTimer = null;
    }
    hideCard();
    hideCardDot();
  }
}

function onCardPointerUp(event) {
  if (!isDragging) return;
  isDragging = false;
  if (selectedCard.hasPointerCapture(event.pointerId)) {
    selectedCard.releasePointerCapture(event.pointerId);
  }
}

function onReviewStarClick(event) {
  const starButton = event.target.closest("button[data-rating]");
  if (!starButton) return;
  window.location.replace(THE_BELGIAN_TOUCH_REVIEW_URL);
}

function clearCardRevealTimer() {
  if (cardRevealTimer === null) return;
  window.clearTimeout(cardRevealTimer);
  cardRevealTimer = null;
}

function scheduleCardReveal() {
  clearCardRevealTimer();
  cardRevealReady = false;
  cardRevealTimer = window.setTimeout(() => {
    cardRevealTimer = null;
    if (!signatureReady) return;
    cardRevealReady = true;
    applyPickedCardToScene();
  }, CARD_REVEAL_DELAY_MS);
}

function setSignatureLocked(isLocked) {
  signatureLocked = isLocked;
  signaturePad.classList.toggle("is-locked", isLocked);
}

function setupSignatureContext() {
  if (!signaturePad) return;

  const previousSignature = signatureReady ? signaturePad.toDataURL() : null;
  const rect = signaturePad.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  signaturePad.width = Math.floor(rect.width * ratio);
  signaturePad.height = Math.floor(rect.height * ratio);

  signatureContext = signaturePad.getContext("2d");
  signatureContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  signatureContext.lineCap = "round";
  signatureContext.lineJoin = "round";
  signatureContext.lineWidth = 2;
  signatureContext.strokeStyle = "#111111";

  if (previousSignature) {
    const image = new Image();
    image.onload = () => {
      signatureContext.drawImage(image, 0, 0, rect.width, rect.height);
    };
    image.src = previousSignature;
  }
}

function signaturePoint(event) {
  const rect = signaturePad.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function onSignaturePointerDown(event) {
  if (signatureLocked || !signatureContext) return;

  signatureIsDrawing = true;
  signaturePad.setPointerCapture(event.pointerId);

  const point = signaturePoint(event);
  signatureLastX = point.x;
  signatureLastY = point.y;
}

function onSignaturePointerMove(event) {
  if (!signatureIsDrawing || signatureLocked || !signatureContext) return;

  const point = signaturePoint(event);
  signatureContext.beginPath();
  signatureContext.moveTo(signatureLastX, signatureLastY);
  signatureContext.lineTo(point.x, point.y);
  signatureContext.stroke();
  signatureLastX = point.x;
  signatureLastY = point.y;

  if (!signatureReady) {
    signatureReady = true;
    cardRemoved = false;
    scheduleCardReveal();
    applyPickedCardToScene();
  }
}

function onSignaturePointerUp(event) {
  if (!signatureIsDrawing) return;
  signatureIsDrawing = false;
  if (signaturePad.hasPointerCapture(event.pointerId)) {
    signaturePad.releasePointerCapture(event.pointerId);
  }
}

function setupSignaturePad() {
  if (!signaturePad) return;

  setupSignatureContext();
  setSignatureLocked(true);

  signaturePad.addEventListener("pointerdown", onSignaturePointerDown);
  signaturePad.addEventListener("pointermove", onSignaturePointerMove);
  signaturePad.addEventListener("pointerup", onSignaturePointerUp);
  signaturePad.addEventListener("pointercancel", onSignaturePointerUp);
}

insuranceOverlay.addEventListener("click", handleInsuranceSelection);
selectedCard.addEventListener("pointerdown", onCardPointerDown);
window.addEventListener("pointermove", onCardPointerMove);
window.addEventListener("pointerup", onCardPointerUp);
window.addEventListener("pointercancel", onCardPointerUp);

window.addEventListener("resize", () => {
  setupSignatureContext();
  if (!selectedCard.classList.contains("is-visible")) return;
  updateCardMetrics();
  setCardPosition(cardPosX, cardPosY);
});

cardStage.addEventListener("dragstart", (event) => {
  event.preventDefault();
});

if (reviewStars) {
  reviewStars.addEventListener("click", onReviewStarClick);
}

if (topLogoRepick) {
  topLogoRepick.addEventListener("click", reopenInsuranceOverlay);
}

preloadCardAssets();
setupSignaturePad();

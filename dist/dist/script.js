// ── SUPABASE CONFIGURATION ───────────────────────────────────
// These two values connect this page to your database.
// Replace with your actual Supabase project URL and anon key.
const SUPABASE_URL = 'https://jeljzhpgylrnhqnlqzev.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-OBlbgt3uHz6TQjKFUyHTQ_iMOltg4Q';

// The name of your table in Supabase where final student
// submissions are stored (matches your existing setup)
const TABLE_NAME = 'student_global';

// Max students per school per topic before it locks
const MAX_PER_TOPIC = 3;


// ── THE 12 CATEGORIES ────────────────────────────────────────
// This is an ARRAY — a list of items stored in order.
// Each item is an OBJECT with properties (key: value pairs).
// 'id'   = a short unique code used to match quiz results
// 'title'= the label shown on the card
// 'icon' = an emoji for visual identity  >> I'm keeping this the same so I can keep them straight. Don't shorten the ID for for any reason. << 

const CATEGORIES = [
  { id: 'Geography & Borders',      title: 'Geography & Borders',     icon: '🗺️' },
  { id: 'Human Rights',             title: 'Human Rights',             icon: '✊' },
  { id: 'Climate & Environment',    title: 'Climate & Environment',    icon: '🌿' },
  { id: 'Global Economics',         title: 'Global Economics',         icon: '📈' },
  { id: 'Governance & Democracy',   title: 'Governance & Democracy',   icon: '🏛️' },
  { id: 'Conflict & Peacebuilding', title: 'Conflict & Peacebuilding', icon: '🕊️' },
  { id: 'Cultural Exchange',        title: 'Cultural Exchange',        icon: '🎭' },
  { id: 'Global Health',            title: 'Global Health',            icon: '🏥' },
  { id: 'Education & Access',       title: 'Education & Access',       icon: '📚' },
  { id: 'Technology & Society',     title: 'Technology & Society',     icon: '💻' },
  { id: 'Migration & Refugees',     title: 'Migration & Refugees',     icon: '🌍' },
  { id: 'Food & Water Security',    title: 'Food & Water Security',    icon: '🌾' },
];

// ── STATE VARIABLES ───────────────────────────────────────────
// These variables hold the current "state" of the page —
// what the student has typed, what topic they selected, etc.
// They start empty/null and get updated as things happen.

let schoolName      = '';      // What the student types in the school field
let selectedId      = null;    // The 'id' of the category the student clicked
let recommendedId   = null;    // The quiz suggestion (read from localStorage)
let availabilityMap = {};      // An OBJECT mapping each category id → count taken


// ── READ QUIZ SUGGESTION FROM LOCALSTORAGE ────────────────────
// localStorage is a way to store small bits of data in the
// browser that persist across pages (but not across devices).
//
// The quiz page should save the result like this:
//   localStorage.setItem('quizResult', 'climate');
//
// Here, we READ that saved value so we can highlight it.

const savedResult = localStorage.getItem('quizResult');
if (savedResult) {
  recommendedId = savedResult;
}


// ── GET REFERENCES TO HTML ELEMENTS ──────────────────────────
// document.getElementById() finds an HTML element by its id=""
// attribute so JavaScript can interact with it.

const schoolSelect    = document.getElementById('school-select');
const customSchoolRow = document.getElementById('custom-school-row');
const schoolCustom    = document.getElementById('school-custom');
const checkBtn        = document.getElementById('check-btn');
const schoolHint      = document.getElementById('school-hint');
const loadingState    = document.getElementById('loading-state');
const gridSection     = document.getElementById('grid-section');
const categoryGrid    = document.getElementById('category-grid');
const confirmRow      = document.getElementById('confirm-row');
const confirmBtn      = document.getElementById('confirm-btn');
const selectedSum     = document.getElementById('selected-summary');


// ── SHOW/HIDE CUSTOM INPUT WHEN "MY SCHOOL ISN'T LISTED" ─────
// When the student picks the "__other__" option from the
// dropdown, we reveal an extra text field for them to type in.

schoolSelect.addEventListener('change', function() {
  if (schoolSelect.value === '__other__') {
    // Show the custom text input
    customSchoolRow.style.display = 'block';
    schoolCustom.focus(); // Move cursor into the field
  } else {
    // Hide it if they pick a listed school
    customSchoolRow.style.display = 'none';
    schoolCustom.value = '';
  }
});


// ── BUTTON CLICK: CHECK AVAILABILITY ─────────────────────────
// addEventListener() listens for user actions on an element.
// 'click' means: run this function when the button is clicked.

checkBtn.addEventListener('click', function() {

  // Figure out which school name to use:
  // If they picked "__other__", read the custom text field.
  // Otherwise, read the dropdown value directly.
  if (schoolSelect.value === '__other__') {
    schoolName = schoolCustom.value.trim();
  } else {
    schoolName = schoolSelect.value.trim();
  }

  // Validate — make sure they actually selected/typed something
  if (!schoolName || schoolSelect.value === '') {
    schoolHint.textContent = '⚠ Please select your school first.';
    schoolHint.className   = 'school-hint error';
    return; // 'return' exits the function early — stops here
  }

  if (schoolSelect.value === '__other__' && !schoolName) {
    schoolHint.textContent = '⚠ Please type your school name.';
    schoolHint.className   = 'school-hint error';
    return;
  }

  // Show loading, hide grid while we wait for Supabase
  loadingState.style.display = 'block';
  gridSection.style.display  = 'none';
  confirmRow.style.display   = 'none';
  schoolHint.textContent     = '';
  schoolHint.className       = 'school-hint';

  // Call our async function that queries Supabase
  fetchAvailability(schoolName);
});

// Also allow pressing Enter in the custom school input field
schoolCustom.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') checkBtn.click();
});


// ── FETCH AVAILABILITY FROM SUPABASE ─────────────────────────
// 'async' means this function can pause and wait for data
// without freezing the whole page. It uses 'await' inside.
//
// This queries your student_global table to count how many
// students from this school already claimed each category.

async function fetchAvailability(school) {

  try {
    // Build the URL for the Supabase REST API call.
    // We're asking: "Give me all rows where school_name matches,
    // and return only the category column."
    //
    // encodeURIComponent() makes the school name URL-safe
    // (e.g. spaces become %20)

    const url = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}`
              + `?school_name=eq.${encodeURIComponent(school)}`
              + `&select=category`;

    // fetch() sends a network request. 'await' pauses here
    // until Supabase responds, then stores the result.
    const response = await fetch(url, {
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
      }
    });

    // If the request failed (bad key, server error, etc.)
    if (!response.ok) {
      throw new Error('Supabase returned status ' + response.status);
    }

    // .json() reads the response body and converts it from
    // JSON text into a real JavaScript array of objects.
    // Example result: [ {category: 'climate'}, {category: 'health'} ]
    const rows = await response.json();

    // ── COUNT OCCURRENCES PER CATEGORY ───────────────────────
    // We now have an array of rows. We need to count how many
    // rows exist for each category id.
    //
    // We build a fresh availabilityMap object, then loop through
    // every row and increment (add 1 to) the count for that id.

    availabilityMap = {}; // Reset the map

    // Initialize all categories to 0 first
    CATEGORIES.forEach(function(cat) {
      availabilityMap[cat.id] = 0;
    });

    // Loop through the database rows and count each category
    rows.forEach(function(row) {
      // row.category contains the category id string
      if (availabilityMap.hasOwnProperty(row.category)) {
        availabilityMap[row.category] += 1; // += 1 means "add 1 to"
      }
    });

    // Hide loading, render the grid
    loadingState.style.display = 'none';
    renderGrid();

    schoolHint.textContent = `✓ Showing availability for "${school}"`;
    schoolHint.className   = 'school-hint success';

  } catch (err) {
    // If anything went wrong, show an error message
    console.error('Error fetching from Supabase:', err);
    loadingState.style.display = 'none';
    schoolHint.textContent = '⚠ Could not load availability. Check your Supabase settings.';
    schoolHint.className   = 'school-hint error';
  }
}


// ── RENDER THE CATEGORY GRID ──────────────────────────────────
// This function builds the 12 cards and inserts them into
// the page. It reads from CATEGORIES and availabilityMap.

function renderGrid() {

  // Clear out any previously rendered cards
  categoryGrid.innerHTML = '';

  // Loop through each category and build a card for it.
  // forEach() runs a function once for each item in the array.
  CATEGORIES.forEach(function(cat) {

    // How many students from this school already have this topic?
    const takenCount = availabilityMap[cat.id] || 0;
    const isFull     = takenCount >= MAX_PER_TOPIC;
    const spotsLeft  = MAX_PER_TOPIC - takenCount;
    const isRec      = (cat.id === recommendedId);

    // ── BUILD THE CARD HTML ───────────────────────────────────
    // Template literals (backticks `) let us write HTML strings
    // with variables inside ${ } placeholders.

    // Determine badge label and fill class for the progress bar
    let badgeHTML   = '';
    let fillClass   = 'fill-' + takenCount; // e.g. 'fill-0', 'fill-2', 'fill-3'
    let spotsText   = '';
    let spotsColor  = '';

    if (isFull) {
      badgeHTML  = '<span class="badge full-badge">FULL</span>';
      spotsText  = 'No spots left';
      spotsColor = 'color: var(--coral)';
    } else if (takenCount === 2) {
      badgeHTML  = '<span class="badge warn-badge">1 LEFT</span>';
      spotsText  = '1 spot left';
      spotsColor = 'color: var(--gold)';
    } else if (takenCount === 0) {
      badgeHTML  = '<span class="badge open-badge">OPEN</span>';
      spotsText  = '3 spots open';
      spotsColor = 'color: var(--teal)';
    } else {
      badgeHTML  = '<span class="badge open-badge">OPEN</span>';
      spotsText  = spotsLeft + ' spot' + (spotsLeft > 1 ? 's' : '') + ' left';
      spotsColor = 'color: var(--teal)';
    }

    // Build CSS class string for the card
    // We add classes conditionally using ternary operators:
    //   condition ? 'if true' : 'if false'
    let cardClasses = 'cat-card';
    if (isFull)     cardClasses += ' cat-full';
    if (isRec)      cardClasses += ' cat-recommended';

    // Build the full card HTML string
    const cardHTML = `
      <div class="${cardClasses}"
           data-id="${cat.id}"
           data-full="${isFull}"
           role="button"
           tabindex="${isFull ? -1 : 0}"
           aria-label="${cat.title}, ${spotsText}">

        ${isRec ? '<span class="rec-tag">✦ Suggested</span>' : ''}

        <span class="cat-icon">${cat.icon}</span>
        <div class="cat-title">${cat.title}</div>

        ${badgeHTML}

        <div class="spots-row">
          <div class="spots-bar">
            <div class="spots-fill ${fillClass}"></div>
          </div>
          <span class="spots-label" style="${spotsColor}">${spotsText}</span>
        </div>

      </div>
    `;

    // insertAdjacentHTML() adds HTML into the grid without
    // replacing what's already there. 'beforeend' = append.
    categoryGrid.insertAdjacentHTML('beforeend', cardHTML);
  });

  // Show the grid section
  gridSection.style.display = 'block';

  // Attach click handlers to the newly created cards
  attachCardListeners();
}


// ── CARD CLICK HANDLERS ───────────────────────────────────────
// After the cards are rendered, we loop through them and
// add a click listener to each one.

function attachCardListeners() {

  // querySelectorAll() returns ALL elements matching a CSS selector
  const cards = document.querySelectorAll('.cat-card');

  cards.forEach(function(card) {

    card.addEventListener('click', function() {

      // If this category is full, ignore the click
      if (card.dataset.full === 'true') return;

      // dataset.id reads the data-id="..." attribute we set in HTML
      selectedId = card.dataset.id;

      // Remove 'cat-selected' from all cards, then add it only
      // to the one just clicked
      cards.forEach(function(c) { c.classList.remove('cat-selected'); });
      card.classList.add('cat-selected');

      // Show the confirm row with the selected topic name
      showConfirmRow(selectedId);
    });

    // Also support keyboard navigation (pressing Enter on a card)
    card.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') card.click();
    });
  });
}


// ── SHOW CONFIRM ROW ──────────────────────────────────────────
// When a student clicks a card, show the bottom confirm bar
// with their chosen topic name and a button to proceed.

function showConfirmRow(chosenId) {

  // Find the category object with the matching id using find()
  // find() returns the FIRST item in the array where the
  // callback function returns true.
  const chosen = CATEGORIES.find(function(cat) {
    return cat.id === chosenId;
  });

  if (!chosen) return;

  // Update the text in the summary area
  selectedSum.innerHTML = `You selected: <strong>${chosen.icon} ${chosen.title}</strong>`;

  // Show the confirm row
  confirmRow.style.display = 'flex';
}


// ── CONFIRM BUTTON ────────────────────────────────────────────
// When the student clicks "Confirm Topic & Enter Hub",
// save their selection to localStorage so the Hub and
// Final Form can read it, then redirect.

confirmBtn.addEventListener('click', function() {

  if (!selectedId) return;

  // Save to localStorage so the next pages can read it.
  // The final student form should read these values and
  // pre-fill or use them when submitting to Supabase.
  localStorage.setItem('chosenCategory', selectedId);
  localStorage.setItem('chosenSchool',   schoolName);


  window.location.href = 'https://codepen.io/Chandra-Schwab/full/jEMebXq';

  window.location.href = 'https://codepen.io/Chandra-Schwab/full/jEMebXq';
  // For now, we just log to console so you can test:
  console.log('✅ Topic confirmed:', selectedId, '| School:', schoolName);
});
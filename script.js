// =====================================================================
// script.js
// ARCHITECTURE & INTEROP GUIDELINES
// =====================================================================
// This file manages the browser interface, the UI tabs, and the two-way
// connection (interop) between JavaScript and Python via Pyodide.
//
// 1. Python State -> JavaScript UI:
//    Python imports JS functions (updateResources, renderFullGrid,
//    pushAction, updateClimateQueue, ...) and calls them to keep the
//    DOM in sync with the game state.
//
// 2. JavaScript Controls -> Python Logic:
//    Button clicks call pyCall(func, ...args), which runs a method on
//    the global Python `game` object (e.g. game.handle_tile_click(...)).
//
// 3. Resources:
//    Four core resources: Water, Seeds, Energy and Coins.
//    (Community Hope was removed.)
// =====================================================================

// ---------------------------------------------------------------------
// App metadata & global state
// ---------------------------------------------------------------------
const APP_VERSION = "0.5.0";     // shown in the header badge
let pyodideInstance = null;      // set once Pyodide finishes loading
let displayActionHistory = [];   // last 8 actions shown in the history panel
const activatedTopics = new Set(); // topic numbers that have been run ("activated")

// =====================================================================
// TOPIC TEMPLATES (Python source code stored as JS template strings)
// =====================================================================
// Each entry has a title (shown in the dropdown) and the Python code
// (shown in the editor and executed by Pyodide). Topics 2, 3 and 4 are
// also run automatically at startup to build the game itself.
const topicTemplates = {

    // ---------------- TOPIC 1: OOP, Big O, Stack ----------------
    1: {
        title: "Topic 1: Python OOP + Big O + Action Stack",
        code: `# Topic 1: Python OOP + Big O + Stacks
from js import updateResources, pushAction, showToast

class ResourceStorage:
    """
    Encapsulates garden resources using Object-Oriented Programming (OOP).
    Tracks Water, Seeds, Energy, and Coins.
    """
    def __init__(self, water=200, seeds=40, energy=100, coins=150):
        self.water = water
        self.seeds = seeds
        self.energy = energy
        self.coins = coins

    def consume_water(self, amount):
        # Only spend water if we actually have enough
        if self.water >= amount:
            self.water -= amount
            return True
        return False


class ActionStack:
    """
    LIFO (Last-In, First-Out) Stack implementation for O(1) Push and Pop operations.
    Used for recording game history and implementing undo actions.
    """
    def __init__(self):
        self._stack = []

    def push(self, action):
        """Pushes an action onto the top of the stack in O(1) time."""
        self._stack.append(action)
        pushAction(f"Push: {action['name']}")

    def pop(self):
        """Pops and returns the most recent action off the stack in O(1) time."""
        if not self.is_empty():
            act = self._stack.pop()
            pushAction(f"Pop: {act['name']}")
            return act
        return None

    def is_empty(self):
        return len(self._stack) == 0


# Initialization demonstration
res = ResourceStorage()
stack = ActionStack()

stack.push({"name": "Watering Bed #1", "cost": 10})
stack.push({"name": "Planting Tomato", "cost": 15})

popped = stack.pop()
# Synchronize initial resource values with JavaScript frontend
updateResources(res.water, res.seeds, res.energy, res.coins)
print(f"Topic 1 Stack active. Popped item: {popped}")
`
    },

    // ---------------- TOPIC 2: Queue / Deque ----------------
    2: {
        title: "Topic 2: Climate Queues & Deques (FIFO)",
        code: `# Topic 2: Queues & Deques (FIFO Elements)
from collections import deque
import random
from js import updateClimateQueue, showToast

class ClimateQueue:
    """
    FIFO (First-In, First-Out) Queue simulating incoming weather events.
    Utilizes collections.deque for efficient O(1) enqueuing and dequeuing.
    """
    def __init__(self):
        self._queue = deque()

    def enqueue_event(self, event_name):
        """Appends an event to the tail of the queue."""
        self._queue.append(event_name)

    def dequeue_event(self):
        """Removes and returns the front weather event."""
        if self._queue:
            return self._queue.popleft()
        return None

    def get_events(self):
        """Returns current queue state as a list for UI rendering."""
        return list(self._queue)

    def replenish_events(self):
        """Ensures the queue always maintains at least 3 upcoming climate events."""
        events = [
            "Heatwave (-15L Water)",
            "Solar Flare (+20 Wh Energy)",
            "Heavy Rain (+40L Water)",
            "Bountiful Rain (+10L Water, +5 Wh Energy)"
        ]
        while len(self._queue) < 3:
            self.enqueue_event(random.choice(events))


# Instantiate and pre-fill initial events
cq = ClimateQueue()
cq.enqueue_event("Seasonal Rainfall (+35L Water)")
cq.enqueue_event("Solar Flare (+20 Wh Energy)")
cq.enqueue_event("Mild Drought (-10L Water)")

# Sync initial state with JavaScript UI
updateClimateQueue(cq.get_events())
print(f"Topic 2 FIFO Queue initialized with {len(cq.get_events())} events.")
`
    },

    // ---------------- TOPIC 3: Arrays + the whole game engine ----------------
    3: {
        title: "Topic 3: Static/Dynamic Arrays & 2D Memory Grid",
        code: `# Topic 3: Static/Dynamic Arrays, 2D Lists, & Memory Structures
from js import updateResources, renderFullGrid, addPlantsToDropdown, pushAction, updateClimateQueue, updateHeaderStats, showToast

class StaticArray:
    """Simulates a contiguous, fixed-size memory array with index boundary checks."""
    def __init__(self, capacity):
        self._capacity = capacity
        self._data = [None] * capacity   # pre-allocated slots

    def __getitem__(self, index):
        self._check(index)
        return self._data[index]

    def __setitem__(self, index, value):
        self._check(index)
        self._data[index] = value

    def _check(self, index):
        # Unlike normal Python lists, we refuse negative indexes
        if not (0 <= index < self._capacity):
            raise IndexError(f"Index {index} out of bounds.")

    def __len__(self):
        return self._capacity


class DynamicArray:
    """Simulates a dynamically resizing array that doubles capacity when full."""
    def __init__(self, initial_capacity=2):
        self._capacity = initial_capacity
        self._size = 0                      # how many slots are actually used
        self._data = StaticArray(self._capacity)

    def append(self, item):
        # When full, allocate a bigger array (amortized O(1) append)
        if self._size == self._capacity:
            self._resize(self._capacity * 2)
        self._data[self._size] = item
        self._size += 1

    def _resize(self, new_cap):
        print(f"[DynamicArray] Resizing allocation: {self._capacity} -> {new_cap}")
        new_data = StaticArray(new_cap)
        for i in range(self._size):          # copy old items over: O(n)
            new_data[i] = self._data[i]
        self._data = new_data
        self._capacity = new_cap

    def __getitem__(self, index):
        if not (0 <= index < self._size):
            raise IndexError("Index out of bounds.")
        return self._data[index]

    def __len__(self):
        return self._size


class CropNode:
    """Represents an individual plant stored in grid memory."""
    def __init__(self, species, emoji, cost, yield_coins, max_stage=3):
        self.species = species
        self.emoji = emoji
        self.cost = cost
        self.yield_coins = yield_coins
        self.stage = 1  # 1: Seedling, 2: Growing, 3: Mature
        self.max_stage = max_stage
        self.watered = False

    def grow(self):
        """Called each new day. Only watered crops advance a stage."""
        if self.watered and self.stage < self.max_stage:
            self.stage += 1
            self.watered = False   # needs water again for the next stage
            return True
        return False

    def get_display_emoji(self):
        """Seedling -> sprout, growing -> leaf, mature -> the real crop emoji."""
        if self.stage == 1:
            return "🌱"
        elif self.stage == 2:
            return "🌿"
        else:
            return self.emoji


class GardenSimulator:
    """Main Game Engine managing resources, 2D grid memory, and user interactions."""
    def __init__(self, rows=5, cols=5):
        self.rows = rows
        self.cols = cols

        # 2D grid built from StaticArrays: an outer array of row arrays
        self.grid = StaticArray(rows)
        for r in range(rows):
            row_arr = StaticArray(cols)
            for c in range(cols):
                row_arr[c] = None          # None = empty tile
            self.grid[r] = row_arr

        # Core resource pool
        self.water = 200   # starts full
        self.seeds = 40
        self.energy = 100
        self.coins = 150
        self.day = 1
        self.stewardship = 0

        # LIFO action stack used by undo()
        self.action_stack = []

        # Seed bank is a DynamicArray, so unlocking species appends to it
        self.seed_bank = DynamicArray(initial_capacity=2)
        self.seed_bank.append({"species": "Maize", "emoji": "🌽", "cost": 5, "yield": 30})
        self.seed_bank.append({"species": "Tomato", "emoji": "🍅", "cost": 8, "yield": 45})

    def sync_ui(self):
        """Flushes game engine state to the JavaScript DOM frontend."""
        updateResources(self.water, self.seeds, self.energy, self.coins)
        updateHeaderStats(self.day, self.calculate_stewardship())

        # Flatten the 2D grid into a 1D list (row by row) for JS to render
        flat_grid = []
        for r in range(self.rows):
            for c in range(self.cols):
                crop = self.grid[r][c]
                if crop:
                    flat_grid.append({
                        "species": crop.species,
                        "emoji": crop.get_display_emoji(),
                        "stage": crop.stage,
                        "watered": crop.watered,
                        "is_mature": crop.stage >= crop.max_stage
                    })
                else:
                    flat_grid.append(None)
        renderFullGrid(flat_grid)

        # Rebuild the seed dropdown from the DynamicArray
        dropdown = []
        for i in range(len(self.seed_bank)):
            s = self.seed_bank[i]
            dropdown.append([s["species"], s["emoji"], s["cost"]])
        addPlantsToDropdown(dropdown)

    def calculate_stewardship(self):
        """Score = percentage of tiles that currently hold a crop."""
        total_tiles = self.rows * self.cols
        planted = sum(1 for r in range(self.rows) for c in range(self.cols) if self.grid[r][c] is not None)
        self.stewardship = int((planted / total_tiles) * 100)
        return self.stewardship

    def handle_tile_click(self, index, selected_species):
        """Processes tile interactions: Planting, Watering, or Harvesting."""
        # Convert the 1D tile index back into (row, col)
        row = index // self.cols
        col = index % self.cols
        crop = self.grid[row][col]

        if crop is None:
            # ---------- PLANTING (tile is empty) ----------
            # Linear search the seed bank for the chosen species
            seed_info = None
            for i in range(len(self.seed_bank)):
                if self.seed_bank[i]["species"] == selected_species:
                    seed_info = self.seed_bank[i]
                    break

            if not seed_info:
                showToast("Select a valid crop species!")
                return

            # Check every requirement before spending anything
            if self.coins < seed_info["cost"]:
                showToast(f"Not enough coins! Need {seed_info['cost']}c.")
                return

            if self.seeds < 1:
                showToast("No seeds remaining!")
                return

            if self.energy < 2:
                showToast("Not enough energy! Need 2 Wh to plant.")
                return

            # Deduct resources and place the new crop in the grid
            new_crop = CropNode(seed_info["species"], seed_info["emoji"], seed_info["cost"], seed_info["yield"])
            self.grid[row][col] = new_crop
            self.coins -= seed_info["cost"]
            self.seeds -= 1
            self.energy -= 2

            action_desc = f"Planted {new_crop.species} (-2 Wh)"
            # Push to the undo stack (stores what undo needs to refund)
            self.action_stack.append({"type": "plant", "row": row, "col": col, "cost": seed_info["cost"], "energy_used": 2})
            pushAction(action_desc)
            showToast(action_desc)

        elif not crop.watered and crop.stage < crop.max_stage:
            # ---------- WATERING (crop is growing and thirsty) ----------
            if self.water < 10:
                showToast("Not enough water! Need 10L.")
                return

            if self.energy < 1:
                showToast("Not enough energy! Need 1 Wh to water.")
                return

            self.water -= 10
            self.energy -= 1
            crop.watered = True
            action_desc = f"Watered {crop.species} (-1 Wh)"
            self.action_stack.append({"type": "water", "row": row, "col": col, "water_used": 10, "energy_used": 1})
            pushAction(action_desc)
            showToast(action_desc)

        elif crop.stage >= crop.max_stage:
            # ---------- HARVESTING (crop is mature) ----------
            yield_val = crop.yield_coins
            self.coins += yield_val
            self.energy = min(120, self.energy + 15)  # reward, capped at max energy
            self.seeds = min(100, self.seeds + 2)     # reward, capped at max seeds
            self.grid[row][col] = None                # tile is empty again

            action_desc = f"Harvested {crop.species} (+15 Wh, +{yield_val}c)"
            pushAction(action_desc)
            showToast(action_desc)

        # Always refresh the UI after a click
        self.sync_ui()

    def water_all(self):
        """Batch waters all unwatered crops if sufficient water and energy exist."""
        # Collect every growing, unwatered crop along with its position
        unwatered = [(r, c, self.grid[r][c]) for r in range(self.rows) for c in range(self.cols)
                     if self.grid[r][c] and not self.grid[r][c].watered and self.grid[r][c].stage < self.grid[r][c].max_stage]

        if not unwatered:
            return showToast("No crops currently need water!")

        if self.water < 10 or self.energy < 1:
            return showToast("Insufficient water or energy to perform batch watering!")

        # Water as many crops as resources allow (10 L and 3 Wh each)
        max_by_water = self.water // 10
        max_by_energy = self.energy // 1
        limit = min(len(unwatered), max_by_water, max_by_energy)

        if limit == 0:
            return showToast("Not enough resources!")

        crops_to_water = unwatered[:limit]
        self.water -= limit * 10
        self.energy -= limit * 1

        for r, c, crop in crops_to_water:
            crop.watered = True
            # One undo entry per crop so undo can reverse them one at a time
            self.action_stack.append({"type": "water", "row": r, "col": c, "water_used": 10, "energy_used": 1})

        pushAction(f"Watered {limit} crop(s)")
        showToast(f"Successfully watered {limit} crop(s)!")
        self.sync_ui()

    def advance_day(self):
        """Advances game day, processes incoming climate events, and grows crops."""
        self.day += 1
        grew_count = 0

        # Daily solar + water recharge so you never get stuck
        self.energy = min(120, self.energy + 15)
        self.water = min(200, self.water + 100)   # +100 L every day (max 200)

        # Process the next climate event (FIFO: the oldest event goes first).
        # 'cq' is the ClimateQueue created by Topic 2, so we check it exists.
        if 'cq' in globals():
            event = cq.dequeue_event()
            if event:
                # Apply the event's effect to resources (clamped to min/max)
                if "Water" in event:
                    if "+40L" in event: self.water = min(200, self.water + 40)
                    elif "+35L" in event: self.water = min(200, self.water + 35)
                    elif "+10L" in event: self.water = min(200, self.water + 10)
                    elif "-15L" in event: self.water = max(0, self.water - 15)
                    elif "-10L" in event: self.water = max(0, self.water - 10)
                if "+20 Wh Energy" in event:
                    self.energy = min(120, self.energy + 20)
                elif "+5 Wh Energy" in event:
                    self.energy = min(120, self.energy + 5)

                pushAction(f"Climate Event: {event}")
                showToast(f"Climate: {event}")

            # Top the queue back up to 3 upcoming events and redraw it
            cq.replenish_events()
            updateClimateQueue(cq.get_events())

        # Grow every crop (only watered ones advance)
        for r in range(self.rows):
            for c in range(self.cols):
                crop = self.grid[r][c]
                if crop and crop.grow():
                    grew_count += 1

        # FIX: watering is "used up" when the day advances (crop.watered resets).
        # Drop old water entries from the undo stack so Undo can't pop an
        # action that no longer has anything to reverse (and refund nothing).
        self.action_stack = [a for a in self.action_stack if a["type"] != "water"]

        pushAction(f"Day {self.day}: {grew_count} crops grew!")
        showToast(f"Dawn of Day {self.day}!")
        self.sync_ui()

    def add_rare_seed(self):
        """Appends new species options to the DynamicArray seed bank."""
        rare_crops = [
            {"species": "Wheat", "emoji": "🌾", "cost": 4, "yield": 25},
            {"species": "Carrot", "emoji": "🥕", "cost": 6, "yield": 35},
            {"species": "Pumpkin", "emoji": "🎃", "cost": 12, "yield": 75},
            {"species": "Sunflower", "emoji": "🌻", "cost": 9, "yield": 55}
        ]

        # Unlock the first species not already in the seed bank
        existing = [self.seed_bank[i]["species"] for i in range(len(self.seed_bank))]
        for rc in rare_crops:
            if rc["species"] not in existing:
                self.seed_bank.append(rc)   # may trigger a DynamicArray resize
                pushAction(f"Unlocked Crop: {rc['species']}")
                showToast(f"New seed unlocked: {rc['species']}!")
                self.sync_ui()
                return
        showToast("All available species are already unlocked!")

    def undo(self):
        """Pops the last action off the action stack and reverts resource/grid state."""
        if not self.action_stack:
            showToast("Nothing to undo!")
            return

        last_action = self.action_stack.pop()   # LIFO: most recent action first
        r, c = last_action["row"], last_action["col"]

        if last_action["type"] == "plant":
            # Remove the crop and refund coins, the seed and energy
            crop = self.grid[r][c]
            if crop:
                self.coins += last_action["cost"]
                self.seeds += 1
                self.energy = min(120, self.energy + last_action.get("energy_used", 2))
                self.grid[r][c] = None
                showToast(f"Undid planting at ({r},{c})")

        elif last_action["type"] == "water":
            # Un-water the crop and refund water and energy
            crop = self.grid[r][c]
            if crop and crop.watered:
                crop.watered = False
                self.water += last_action["water_used"]
                self.energy = min(120, self.energy + last_action.get("energy_used", 1))
                showToast(f"Undid watering at ({r},{c})")

        self.sync_ui()


# Global game engine instance. pyCall() in JavaScript looks for this
# variable named "game", so don't rename it.
game = GardenSimulator()
game.sync_ui()
`
    },

    // ---------------- TOPIC 4: Trees & traversals ----------------
    4: {
        title: "Topic 4: Hierarchical Trees & Traversals",
        code: `# Topic 4: Hierarchical Trees & Traversals
from collections import deque
from js import renderTreeHierarchy, updateTraversalOutput

class TreeNode:
    """Represents a sector/node in the Garden Hierarchy Tree."""
    def __init__(self, name, icon="🌿"):
        self.name = name
        self.icon = icon
        self.children = []   # a general tree: any number of children

    def add_child(self, child_node):
        self.children.append(child_node)
        return child_node    # returned so we can keep adding to it


# --- Traversal Algorithms ---
def pre_order_traversal(node, result=None):
    """Visit the node FIRST, then each child (Root -> Children)."""
    if result is None:
        result = []
    result.append(f"{node.icon} {node.name}")
    for child in node.children:
        pre_order_traversal(child, result)
    return result

def post_order_traversal(node, result=None):
    """Visit all children FIRST, then the node (Children -> Root)."""
    if result is None:
        result = []
    for child in node.children:
        post_order_traversal(child, result)
    result.append(f"{node.icon} {node.name}")
    return result

def in_order_traversal(node, result=None):
    """First child -> Root -> Remaining children (in-order adapted for a general tree)."""
    if result is None:
        result = []
    if node.children:
        in_order_traversal(node.children[0], result)
    result.append(f"{node.icon} {node.name}")
    for child in node.children[1:]:
        in_order_traversal(child, result)
    return result

def level_order_bfs(root):
    """Breadth-First Traversal: visit level by level using a FIFO queue."""
    if not root:
        return []
    result = []
    queue = deque([root])
    while queue:
        curr = queue.popleft()          # take from the front
        result.append(f"{curr.icon} {curr.name}")
        for child in curr.children:
            queue.append(child)         # add children to the back
    return result


# Construct the tree:
#   Sanctuary Master Core
#   |-- North Hydro Zone  (Crop Bed A, Crop Bed B)
#   |-- South Solar Array (Greenhouse, Compost Vault)
root_ecosystem = TreeNode("Sanctuary Master Core", "🌳")

north_sector = root_ecosystem.add_child(TreeNode("North Hydro Zone", "🏞️"))
north_sector.add_child(TreeNode("Crop Bed A (Maize)", "🌽"))
north_sector.add_child(TreeNode("Crop Bed B (Wheat)", "🌾"))

south_sector = root_ecosystem.add_child(TreeNode("South Solar Array", "☀️"))
south_sector.add_child(TreeNode("Greenhouse (Tomatoes)", "🍅"))
south_sector.add_child(TreeNode("Compost Vault", "🪱"))


def build_tree_dict(node):
    """Recursively converts the tree into nested dicts so JavaScript can draw it."""
    return {
        "name": node.name,
        "icon": node.icon,
        "children": [build_tree_dict(c) for c in node.children]
    }

# Draw the tree in the browser
renderTreeHierarchy(build_tree_dict(root_ecosystem))

def execute_traversal_mode(mode):
    """Called from JavaScript when a traversal button is clicked."""
    if mode == "pre_order":
        seq = pre_order_traversal(root_ecosystem)
    elif mode == "post_order":
        seq = post_order_traversal(root_ecosystem)
    elif mode == "in_order":
        seq = in_order_traversal(root_ecosystem)
    else:
        seq = level_order_bfs(root_ecosystem)

    updateTraversalOutput(" -> ".join(seq))

execute_traversal_mode("bfs")   # show BFS by default
print("Topic 4 Ecosystem Tree loaded successfully.")
`
    },

    // Topics 5-8 are placeholders for you to fill in later
    5: { title: "Topic 5: Binary Search Trees (BST) & Node Mutation", code: `# Topic 5\n` },
    6: { title: "Topic 6: Hash Tables, Collisions, & Rehashing", code: `# Topic 6\n` },
    7: { title: "Topic 7: Graph Foundations & DFS/BFS", code: `# Topic 7\n` },
    8: { title: "Topic 8: Sorting Algorithms", code: `# Topic 8\n` }
};

// =====================================================================
// INITIALIZATION & DOM SETUP
// =====================================================================
// Runs once the HTML has finished loading
window.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('version-badge').textContent = `v${APP_VERSION}`;
    lucide.createIcons();      // turn <i data-lucide> tags into SVG icons
    populateTopicDropdown();   // fill the code editor's topic list
    refreshTopicUI();          // draw the topic status chips
    initPyodideEngine();       // start loading Python (takes a few seconds)
});

// Fills the topic <select> from topicTemplates
function populateTopicDropdown() {
    const sel = document.getElementById('topic-selector');
    sel.innerHTML = '';
    for (let key in topicTemplates) {
        let opt = document.createElement('option');
        opt.value = key;
        opt.textContent = topicTemplates[key].title;
        sel.appendChild(opt);
    }
    loadTopic();   // show the first topic's code immediately
}

// Puts the selected topic's Python code into the editor textarea
function loadTopic() {
    const key = document.getElementById('topic-selector').value;
    document.getElementById('code-editor').value = topicTemplates[key].code;
}

// =====================================================================
// PYODIDE INITIALIZATION & EXECUTION ENGINE
// =====================================================================
async function initPyodideEngine() {
    try {
        pyodideInstance = await loadPyodide();
        console.log("Pyodide Engine loaded successfully.");

        // Run the core topics so the game exists as soon as Python is ready.
        // ORDER MATTERS:
        //   Topic 3 creates `game` (and draws the grid),
        //   Topic 4 builds the tree,
        //   Topic 2 creates `cq` (the climate queue) that game.advance_day() uses.
        await pyodideInstance.runPythonAsync(topicTemplates[3].code);
        await pyodideInstance.runPythonAsync(topicTemplates[4].code);
        await pyodideInstance.runPythonAsync(topicTemplates[2].code);

        // NOTE: Topics 2, 3 and 4 run silently here only to power the game.
        // They are NOT marked as activated: a topic only shows ✓ / "Active"
        // after the student runs it themselves with the Run button.
        refreshTopicUI();
        setEngineStatus("ready", "Python ready");
        showToast("Welcome! Pick a seed, then click an empty tile to plant 🌱");
    } catch (err) {
        console.error("Failed to initialize Pyodide:", err);
        setEngineStatus("error", "Python failed to load");
    }
}

// Reports engine problems to the user (the "ready" state needs no indicator)
function setEngineStatus(state, text) {
    // The header pill was removed; only report failures (via a toast)
    if (state === "error") showToast(text);
}

// Redraws the topic chips and adds a check mark to activated topics in the dropdown
function refreshTopicUI() {
    const chips = document.getElementById('topic-chips');
    chips.innerHTML = '';
    for (let key in topicTemplates) {
        const on = activatedTopics.has(key);
        const chip = document.createElement('span');
        chip.className = `topic-chip ${on ? 'active' : ''}`;
        chip.innerHTML = `<span class="dot"></span>Topic ${key}${on ? ' · Active' : ''}`;
        chips.appendChild(chip);
    }
    Array.from(document.getElementById('topic-selector').options).forEach(o => {
        o.textContent = (activatedTopics.has(o.value) ? '✓ ' : '') + topicTemplates[o.value].title;
    });
}

// Marks a topic as activated and shows feedback (toast, console line, button flash)
function markTopicActivated(key) {
    activatedTopics.add(String(key));
    refreshTopicUI();
    showToast(`✅ Topic ${key} activated`);

    const btn = document.getElementById('run-btn');
    const label = document.getElementById('run-btn-label');
    btn.classList.add('activated-flash');
    label.textContent = `Topic ${key} Activated ✓`;
    setTimeout(() => {
        btn.classList.remove('activated-flash');
        label.textContent = 'Run Selected Python Topic';
    }, 2000);
}

// Runs whatever Python is in the editor (the "Run Selected Python Topic" button)
async function runPythonCode() {
    if (!pyodideInstance) {
        showToast("Pyodide is still loading...");
        return;
    }
    const code = document.getElementById("code-editor").value;
    const consoleBox = document.getElementById("output-console");
    consoleBox.innerText = "Running Python code...\n";

    try {
        // Redirect Python's print() output into our on-page console box
        pyodideInstance.setStdout({
            batched: (text) => {
                consoleBox.innerText += text + "\n";
            }
        });

        await pyodideInstance.runPythonAsync(code);

        // Success: show the activation indicator
        const topicKey = document.getElementById('topic-selector').value;
        consoleBox.innerText += `\n✅ Topic ${topicKey} activated successfully.`;
        markTopicActivated(topicKey);
    } catch (err) {
        // Show Python errors (syntax errors, exceptions) in the console box
        consoleBox.innerText += "\nExecution Error:\n" + err.toString();
        console.error("Pyodide Execution Error:", err);
    }
}

/**
 * Safely calls a method on the Python `game` object.
 * Example: pyCall('handle_tile_click', 7, 'Maize')
 *          runs game.handle_tile_click(7,'Maize') in Python.
 */
function pyCall(func, ...args) {
    if (!pyodideInstance) {
        showToast("Python engine is still loading...");
        return;
    }
    try {
        // Strings need quotes in the generated Python; numbers don't
        const formattedArgs = args.map(a => typeof a === 'string' ? `'${a}'` : a).join(',');
        pyodideInstance.runPython(`
if 'game' in globals():
    game.${func}(${formattedArgs})
else:
    print("Error: 'game' object not found in Python global scope.")
        `);
    } catch (err) {
        console.error(`Error calling ${func}:`, err);
        showToast(`Execution Error: ${err.message}`);
    }
}

// Undo button handler: runs game.undo() in Python
function triggerUndo() {
    pyCall('undo');
}

// Tree traversal button handler: runs execute_traversal_mode('<mode>') in Python
function runTreeTraversal(mode) {
    if (!pyodideInstance) return;
    try {
        pyodideInstance.runPython(`execute_traversal_mode('${mode}')`);
    } catch (err) {
        console.error("Traversal execution error:", err);
    }
}

// =====================================================================
// JAVASCRIPT / PYTHON INTEROP BRIDGE FUNCTIONS
// =====================================================================
// Python imports these with "from js import ..." and calls them to
// update the page. Python lists/dicts arrive as PyProxy objects, so
// we call .toJs() to convert them into real JavaScript values.

/**
 * Updates the resource numbers and progress bars.
 * Bar width = value / max * 100 (maximums: water 200, seeds 100, energy 120).
 */
function updateResources(water, seeds, energy, coins) {
    document.getElementById('water-text').textContent = `${water} / 200 L`;
    document.getElementById('water-bar').style.width = `${(water / 200) * 100}%`;

    document.getElementById('seeds-text').textContent = `${seeds} / 100`;
    document.getElementById('seeds-bar').style.width = `${(seeds / 100) * 100}%`;

    document.getElementById('energy-text').textContent = `${energy} / 120 Wh`;
    document.getElementById('energy-bar').style.width = `${(energy / 120) * 100}%`;

    document.getElementById('coins-text').textContent = `${coins} Coins`;
}

/**
 * Updates the Day and Score counters in the header.
 */
function updateHeaderStats(day, stewardship) {
    document.getElementById('day-counter').textContent = day;
    document.getElementById('stewardship-counter').textContent = `${stewardship}%`;
}

/**
 * Fills the "Selected Seed" dropdown from Python's seed bank.
 * Receives a list of [species, emoji, cost] lists (no dicts, so no
 * special conversion needed).
 */
function addPlantsToDropdown(pyList) {
    const sel = document.getElementById('crop-selector');
    const currentVal = sel.value;   // remember the current choice
    sel.innerHTML = '';

    let jsArr = pyList.toJs ? pyList.toJs() : pyList;
    jsArr.forEach(item => {
        let opt = document.createElement('option');
        opt.value = item[0];                                        // species name
        opt.textContent = `${item[1]} ${item[0]} (${item[2]}c)`;    // "🌽 Maize (10c)"
        sel.appendChild(opt);
    });

    // Restore the previous selection so the dropdown doesn't reset
    if (currentVal && Array.from(sel.options).some(o => o.value === currentVal)) {
        sel.value = currentVal;
    }
}

/**
 * Draws the 5x5 garden grid from the flat list Python sends.
 * Each item is either null (empty tile) or a dict describing a crop.
 */
function renderFullGrid(pyGrid) {
    const gridEl = document.getElementById('garden-grid');
    gridEl.innerHTML = '';

    // FIX: by default .toJs() converts Python dicts into JavaScript Map
    // objects, so tile.emoji / tile.species came out as undefined.
    // dict_converter: Object.fromEntries makes them plain JS objects.
    let jsGrid = pyGrid.toJs ? pyGrid.toJs({ dict_converter: Object.fromEntries }) : pyGrid;

    jsGrid.forEach((tile, idx) => {
        const div = document.createElement('div');
        div.className = "aspect-square rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all duration-150 p-1 relative select-none ";

        if (!tile) {
            // Empty tile: show its number
            div.className += "bg-[#1a1236]/80 border-emerald-900/40 hover:border-emerald-500/60 hover:bg-[#2a1d52]";
            div.innerHTML = `<span class="text-xs text-emerald-700/60 font-semibold">${idx + 1}</span>`;
        } else {
            // Border color shows status: amber = mature, blue = watered, green = needs water
            if (tile.is_mature) {
                div.className += "bg-amber-950/30 border-amber-500/60 hover:border-amber-400";
            } else if (tile.watered) {
                div.className += "bg-blue-950/30 border-blue-500/60 hover:border-blue-400";
            } else {
                div.className += "bg-emerald-950/40 border-emerald-700/50 hover:border-emerald-400";
            }

            // Crop emoji + name, plus a small blue dot if it's been watered
            div.innerHTML = `
                <span class="text-2xl">${tile.emoji}</span>
                <span class="text-[10px] font-bold text-emerald-200 truncate w-full text-center">${tile.species}</span>
                ${tile.watered ? '<span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-400"></span>' : ''}
            `;
        }

        // Clicking a tile tells Python which tile (idx) and which seed is selected
        div.onclick = () => {
            const selectedCrop = document.getElementById('crop-selector').value;
            pyCall('handle_tile_click', idx, selectedCrop);
        };

        gridEl.appendChild(div);
    });
}

/**
 * Adds a message to the Action History panel (newest on top, max 8 shown).
 */
function pushAction(actionStr) {
    displayActionHistory.unshift(actionStr);                       // add to front
    if (displayActionHistory.length > 8) displayActionHistory.pop(); // drop the oldest

    const stackEl = document.getElementById('action-stack');
    stackEl.innerHTML = '';
    displayActionHistory.forEach((act, idx) => {
        const item = document.createElement('div');
        item.className = "bg-[#1c1438] border border-emerald-900/50 p-2 rounded-lg text-xs text-emerald-200 flex items-center justify-between";
        item.innerHTML = `<span>${act}</span> <span class="text-[9px] text-emerald-500 font-mono">#${displayActionHistory.length - idx}</span>`;
        stackEl.appendChild(item);
    });
}

/**
 * Draws the Climate Queue panel. Receives a list of strings.
 */
function updateClimateQueue(pyEvents) {
    let jsEvents = pyEvents.toJs ? pyEvents.toJs() : pyEvents;
    const qEl = document.getElementById('climate-queue');
    qEl.innerHTML = '';
    jsEvents.forEach((ev, idx) => {
        const div = document.createElement('div');
        div.className = "bg-[#1c1438] border border-emerald-800/40 p-2.5 rounded-xl text-xs flex items-center justify-between";
        div.innerHTML = `<span class="text-emerald-200 font-medium">${ev}</span> <span class="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-800/60">POS ${idx + 1}</span>`;
        qEl.appendChild(div);
    });
}

/**
 * Draws the ecosystem tree from nested dicts sent by Python.
 */
function renderTreeHierarchy(pyTree) {
    // FIX: same Map problem as the grid, so convert dicts to plain objects.
    let tree = pyTree.toJs ? pyTree.toJs({ dict_converter: Object.fromEntries }) : pyTree;
    const container = document.getElementById('tree-container');
    container.innerHTML = '';

    // Recursive: builds the HTML for a node, then for each of its children
    function buildNodeHTML(node) {
        let html = `<div class="flex flex-col items-center">
            <div class="tree-node bg-[#241a4a] border border-emerald-700/60 rounded-xl px-3 py-1.5 text-xs text-emerald-100 flex items-center gap-1.5 shadow-md">
                <span>${node.icon}</span>
                <span class="font-semibold">${node.name}</span>
            </div>`;

        if (node.children && node.children.length > 0) {
            html += `<div class="w-0.5 h-3 bg-emerald-700/50"></div>`;               // vertical connector
            html += `<div class="flex gap-4 border-t border-emerald-700/50 pt-3">`;  // row of children
            node.children.forEach(child => {
                html += buildNodeHTML(child);   // recursion
            });
            html += `</div>`;
        }
        html += `</div>`;
        return html;
    }

    container.innerHTML = buildNodeHTML(tree);
}

/**
 * Shows the traversal result text (e.g. "🌳 Root -> 🏞️ North -> ...").
 */
function updateTraversalOutput(seqText) {
    document.getElementById('traversal-output').textContent = seqText;
}

/**
 * Shows a small pop-up message in the corner for 2.5 seconds, then fades it out.
 */
function showToast(msg) {
    let toast = document.createElement('div');
    toast.className = "fixed bottom-5 right-5 bg-emerald-900 border border-emerald-500 text-emerald-100 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg z-50 transition-all duration-300";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';                    // fade out
        setTimeout(() => toast.remove(), 300);        // then remove from the page
    }, 2500);
}

// =====================================================================
// UI NAVIGATION & TAB SWITCHING
// =====================================================================
// Shows one of the three center views ('game', 'code', 'tree') and
// highlights the matching tab button.
function switchTab(tab) {
    const gameView = document.getElementById('view-game');
    const codeView = document.getElementById('view-code');
    const treeView = document.getElementById('view-tree');

    const btnGame = document.getElementById('tab-game');
    const btnCode = document.getElementById('tab-code');
    const btnTree = document.getElementById('tab-tree');

    // 1. Reset every tab button to the "inactive" look
    [btnGame, btnCode, btnTree].forEach(b => {
        b.className = "px-4 py-1.5 rounded-lg text-xs font-bold text-emerald-400/80 hover:text-emerald-100 flex items-center gap-1.5";
    });

    // 2. Hide all three views
    gameView.classList.add('hidden');
    codeView.classList.add('hidden');
    treeView.classList.add('hidden');

    // 3. Show the chosen view and give its button the "active" look
    if (tab === 'game') {
        gameView.classList.remove('hidden');
        btnGame.className = "px-4 py-1.5 rounded-lg text-xs font-bold bg-[#3b2a6b] text-emerald-100 flex items-center gap-1.5";
    } else if (tab === 'code') {
        codeView.classList.remove('hidden');
        btnCode.className = "px-4 py-1.5 rounded-lg text-xs font-bold bg-[#3b2a6b] text-emerald-100 flex items-center gap-1.5";
    } else if (tab === 'tree') {
        treeView.classList.remove('hidden');
        btnTree.className = "px-4 py-1.5 rounded-lg text-xs font-bold bg-[#3b2a6b] text-emerald-100 flex items-center gap-1.5";
    }
}
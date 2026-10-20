// =====================================================================
// script.js
// ARCHITECTURE & INTEROP GUIDELINES
// =====================================================================
// This file manages the browser interface, the UI tabs, and the two-way
// connection (interop) between JavaScript and Python via Pyodide.
//
// 1. Python State -> JavaScript UI:
//    Python imports JS functions (updateResources, pushAction,
//    updateClimateQueue, ...) and calls them to keep the DOM in sync.
//
// 2. JavaScript Controls -> Python Logic:
//    Button clicks call pyCall(func, ...args), which runs a method on
//    the global Python `game` object (e.g. game.handle_tile_click(...)).
//
// 3. BST <-> Grid sync (NEW):
//    The Python BST `gardenTree` uses the TILE INDEX (0-24) as its key.
//    After every pyCall / bstCall, syncFromBST() fetches
//    gardenTree.get_all_sorted() and gardenTree.to_dict() and re-renders
//    BOTH the garden grid and the BST view from that one source.
//
// 4. Resources: Water, Seeds, Energy and Coins.
// =====================================================================

// ---------------------------------------------------------------------
// App metadata & global state
// ---------------------------------------------------------------------
const APP_VERSION = "0.6.0";     // shown in the header badge
const GRID_TILES = 25;           // 5 x 5, tile indexes 0-24
let pyodideInstance = null;      // set once Pyodide finishes loading
let displayActionHistory = [];   // last 8 actions shown in the history panel
const activatedTopics = new Set(); // topic numbers that have been run ("activated")

// =====================================================================
// TOPIC TEMPLATES (Python source code stored as JS template strings)
// =====================================================================
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
from js import updateResources, addPlantsToDropdown, pushAction, updateClimateQueue, updateHeaderStats, showToast

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
    """Main Game Engine managing resources, 2D grid memory, and user interactions.

    Tile index (0-24) is also the BST key: planting on tile X inserts key X into
    gardenTree (Topic 5). Both structures hold the SAME CropNode objects."""
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

        # The BST (Topic 5) mirrors this grid, so start it empty too.
        if 'gardenTree' in globals():
            gardenTree.clear()

    def sync_ui(self):
        """Flushes resources/header/seed list to the DOM. The grid and the BST
        are drawn by JavaScript (syncFromBST) from gardenTree."""
        updateResources(self.water, self.seeds, self.energy, self.coins)
        updateHeaderStats(self.day, self.calculate_stewardship())

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

    def _in_bounds(self, index):
        return 0 <= index < self.rows * self.cols

    # ---------- Tile interactions (tile index == BST key) ----------
    def handle_tile_click(self, index, selected_species):
        """Empty -> plant, growing -> water, mature -> harvest."""
        index = int(index)
        if not self._in_bounds(index):
            showToast(f"Tile {index} is outside the grid (0-{self.rows * self.cols - 1})!")
            return

        node = gardenTree.search(index)          # BST lookup by tile index
        if node is None:
            self.plant_tile(index, selected_species)
        elif node.crop.stage >= node.crop.max_stage:
            self.harvest_tile(index)
        else:
            self.water_tile(index)
        self.sync_ui()

    def plant_tile(self, index, species):
        """Plants on tile X and calls gardenTree.insert(X, crop)."""
        index = int(index)
        if not self._in_bounds(index):
            showToast(f"Tile {index} is outside the grid (0-{self.rows * self.cols - 1})!")
            return False
        if gardenTree.search(index) is not None:
            showToast(f"Tile {index} already has a plant!")
            return False

        # Linear search the seed bank for the chosen species
        seed_info = None
        for i in range(len(self.seed_bank)):
            if self.seed_bank[i]["species"] == species:
                seed_info = self.seed_bank[i]
                break

        if not seed_info:
            showToast("Select a valid crop species!")
            return False
        if self.coins < seed_info["cost"]:
            showToast(f"Not enough coins! Need {seed_info['cost']}c.")
            return False
        if self.seeds < 1:
            showToast("No seeds remaining!")
            return False
        if self.energy < 2:
            showToast("Not enough energy! Need 2 Wh to plant.")
            return False

        row, col = divmod(index, self.cols)
        new_crop = CropNode(seed_info["species"], seed_info["emoji"], seed_info["cost"], seed_info["yield"])
        self.grid[row][col] = new_crop            # Topic 3: 2D array storage
        gardenTree.insert(index, new_crop)        # Topic 5: BST, key = tile index

        self.coins -= seed_info["cost"]
        self.seeds -= 1
        self.energy -= 2
        self.action_stack.append({"type": "plant", "row": row, "col": col,
                                  "cost": seed_info["cost"], "energy_used": 2})
        msg = f"Planted {new_crop.species} on tile {index} (-2 Wh)"
        pushAction(msg)
        showToast(msg)
        return True

    def water_tile(self, index):
        """Finds the plant with gardenTree.search(X) and waters it in place."""
        index = int(index)
        node = gardenTree.search(index)
        if node is None:
            showToast(f"Tile {index} is empty.")
            return False
        crop = node.crop
        if crop.stage >= crop.max_stage:
            showToast("Already mature, harvest it!")
            return False
        if crop.watered:
            showToast("Already watered. Advance the day!")
            return False
        if self.water < 10:
            showToast("Not enough water! Need 10L.")
            return False
        if self.energy < 1:
            showToast("Not enough energy! Need 1 Wh to water.")
            return False

        self.water -= 10
        self.energy -= 1
        crop.watered = True                       # same object the grid holds
        row, col = divmod(index, self.cols)
        self.action_stack.append({"type": "water", "row": row, "col": col,
                                  "water_used": 10, "energy_used": 1})
        msg = f"Watered {crop.species} on tile {index} (-1 Wh)"
        pushAction(msg)
        showToast(msg)
        return True

    def harvest_tile(self, index):
        """Calls gardenTree.harvest(X): returns the crop and removes its node."""
        index = int(index)
        node = gardenTree.search(index)
        if node is None or node.crop.stage < node.crop.max_stage:
            showToast("Nothing ready to harvest there.")
            return False

        crop = gardenTree.harvest(index)
        row, col = divmod(index, self.cols)
        self.grid[row][col] = None

        self.coins += crop.yield_coins
        self.energy = min(120, self.energy + 15)  # reward, capped at max energy
        self.seeds = min(100, self.seeds + 2)     # reward, capped at max seeds
        msg = f"Harvested {crop.species} on tile {index} (+15 Wh, +{crop.yield_coins}c)"
        pushAction(msg)
        showToast(msg)
        return True

    def remove_tile(self, index):
        """Uproots a plant with no payout (BST tab's Delete button)."""
        index = int(index)
        if not self._in_bounds(index):
            return False
        if not gardenTree.delete(index):
            return False
        row, col = divmod(index, self.cols)
        self.grid[row][col] = None   # clear the REQUESTED tile, not the successor that moved up
        return True

    def water_all(self):
        """Batch waters all unwatered crops if sufficient water and energy exist."""
        unwatered = [(r, c, self.grid[r][c]) for r in range(self.rows) for c in range(self.cols)
                     if self.grid[r][c] and not self.grid[r][c].watered and self.grid[r][c].stage < self.grid[r][c].max_stage]

        if not unwatered:
            return showToast("No crops currently need water!")

        if self.water < 10 or self.energy < 1:
            return showToast("Insufficient water or energy to perform batch watering!")

        # Water as many crops as resources allow (10 L and 1 Wh each)
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
        if 'cq' in globals():
            event = cq.dequeue_event()
            if event:
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

            cq.replenish_events()
            updateClimateQueue(cq.get_events())

        # Grow every crop (only watered ones advance). The BST nodes hold the
        # same CropNode objects, so they update automatically.
        for r in range(self.rows):
            for c in range(self.cols):
                crop = self.grid[r][c]
                if crop and crop.grow():
                    grew_count += 1

        # Watering is "used up" when the day advances, so drop old water entries
        # from the undo stack.
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
        """Pops the last action off the action stack and reverts resource/grid/BST state."""
        if not self.action_stack:
            showToast("Nothing to undo!")
            return

        last_action = self.action_stack.pop()   # LIFO: most recent action first
        r, c = last_action["row"], last_action["col"]
        idx = r * self.cols + c                 # tile index == BST key

        if last_action["type"] == "plant":
            node = gardenTree.search(idx)
            if node:
                self.coins += last_action["cost"]
                self.seeds += 1
                self.energy = min(120, self.energy + last_action.get("energy_used", 2))
                gardenTree.delete(idx)          # remove from the BST...
                self.grid[r][c] = None          # ...and from the 2D grid
                showToast(f"Undid planting at tile {idx}")

        elif last_action["type"] == "water":
            node = gardenTree.search(idx)
            if node and node.crop.watered:
                node.crop.watered = False
                self.water += last_action["water_used"]
                self.energy = min(120, self.energy + last_action.get("energy_used", 1))
                showToast(f"Undid watering at tile {idx}")

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

    // ---------------- TOPIC 5: BST keyed by tile index ----------------
    5: {
        title: "Topic 5: Binary Search Trees (BST) & Node Mutation",
        code: `# Topic 5: Binary Search Tree keyed by Tile Index (0-24)
from js import updateBSTOutput, pushAction, showToast

class PlantNode:
    """BST node. key = tile index; crop = the SAME CropNode object the grid holds."""
    def __init__(self, key, crop):
        self.key = key
        self.crop = crop
        self.left = None      # smaller tile indexes
        self.right = None     # larger tile indexes


class GardenBST:
    """Binary Search Tree: left < parent < right. Average O(log n)."""
    def __init__(self):
        self.root = None
        self.size = 0
        self.last_delete_case = ""
        self.highlight = []   # keys JavaScript should highlight (last search/insert path)

    def clear(self):
        self.root = None
        self.size = 0
        self.highlight = []

    # ---------- INSERT ----------
    def insert(self, key, crop):
        key = int(key)                       # always an int, never "7"
        new_node = PlantNode(key, crop)
        if self.root is None:
            self.root = new_node
            self.size += 1
            self.highlight = [key]
            return True
        path = []
        cur = self.root
        while True:
            path.append(cur.key)
            if key == cur.key:
                self.highlight = path
                return False                 # duplicate tile index
            elif key < cur.key:
                if cur.left is None:
                    cur.left = new_node
                    break
                cur = cur.left
            else:
                if cur.right is None:
                    cur.right = new_node
                    break
                cur = cur.right
        path.append(key)
        self.highlight = path
        self.size += 1
        return True

    # ---------- SEARCH ----------
    def search_path(self, key):
        """Returns (node or None, list of keys visited on the way)."""
        key = int(key)
        path = []
        cur = self.root
        while cur:
            path.append(cur.key)
            if key == cur.key:
                self.highlight = path
                return cur, path
            cur = cur.left if key < cur.key else cur.right
        self.highlight = path
        return None, path

    def search(self, key):
        return self.search_path(key)[0]

    # ---------- HARVEST = grab the crop, then delete its node ----------
    def harvest(self, key):
        node = self.search(key)
        if node is None:
            return None
        crop = node.crop          # save it BEFORE deleting: with two children,
        self.delete(key)          # delete() overwrites node.crop with the successor's
        return crop

    # ---------- DELETE ----------
    def _min_node(self, node):
        while node.left:
            node = node.left
        return node

    def delete(self, key):
        key = int(key)
        self.root, deleted = self._delete(self.root, key)   # reassign the root pointer
        if deleted:
            self.size -= 1
        self.highlight = []
        return deleted

    def _delete(self, node, key):
        """Returns (new_subtree_root, deleted_flag). The caller MUST reassign
        its child pointer to the returned node."""
        if node is None:
            return None, False
        if key < node.key:
            node.left, deleted = self._delete(node.left, key)
            return node, deleted
        if key > node.key:
            node.right, deleted = self._delete(node.right, key)
            return node, deleted

        # key == node.key: three cases
        if node.left is None and node.right is None:
            self.last_delete_case = "leaf (no children)"
            return None, True
        if node.left is None:
            self.last_delete_case = "one child (right)"
            return node.right, True
        if node.right is None:
            self.last_delete_case = "one child (left)"
            return node.left, True

        # Two children: copy the in-order successor's key AND crop up, then
        # delete the successor from the right subtree.
        succ = self._min_node(node.right)
        node.key = succ.key
        node.crop = succ.crop
        node.right, _ = self._delete(node.right, succ.key)
        self.last_delete_case = "two children (used in-order successor)"  # recursion overwrote it
        return node, True

    # ---------- READ-ONLY VIEWS FOR JAVASCRIPT ----------
    def _info(self, node):
        c = node.crop
        return {"key": node.key, "species": c.species, "emoji": c.get_display_emoji(),
                "stage": c.stage, "watered": c.watered, "is_mature": c.stage >= c.max_stage}

    def get_all_sorted(self):
        """Iterative in-order traversal: list of dicts sorted by tile index."""
        out, stack, cur = [], [], self.root
        while stack or cur:
            while cur:
                stack.append(cur)
                cur = cur.left
            cur = stack.pop()
            out.append(self._info(cur))
            cur = cur.right
        return out

    def to_dict(self, node="root"):
        """Nested dicts so JavaScript can draw the tree shape."""
        if node == "root":
            node = self.root
        if node is None:
            return None
        d = self._info(node)
        d["left"] = self.to_dict(node.left)
        d["right"] = self.to_dict(node.right)
        return d


def tree_height(node):
    if node is None:
        return 0
    return 1 + max(tree_height(node.left), tree_height(node.right))


# Keep the existing tree if the student re-runs this topic, so it stays in sync with the grid.
if 'gardenTree' not in globals():
    gardenTree = GardenBST()


# ---------- Functions the BST tab calls (all go through the game engine) ----------
def say(msg):
    updateBSTOutput(msg)
    pushAction(msg)
    showToast(msg)

def bst_insert(key, species):
    key = int(key)
    if game.plant_tile(key, species):
        updateBSTOutput(f"Inserted tile #{key} ({species}). Size {gardenTree.size}, height {tree_height(gardenTree.root)}")
    game.sync_ui()

def bst_search(key):
    node, path = gardenTree.search_path(int(key))
    steps = " -> ".join(str(p) for p in path)
    if node:
        say(f"Found tile #{key} in {len(path)} steps: {steps}")
    else:
        say(f"Tile #{key} not found. Visited: {steps}")

def bst_delete(key):
    if game.remove_tile(int(key)):
        say(f"Deleted tile #{key}: {gardenTree.last_delete_case}")
    else:
        say(f"Tile #{key} not found, nothing deleted.")
    game.sync_ui()

def bst_water(key):
    if game.water_tile(int(key)):
        updateBSTOutput(f"Watered tile #{key} (same node, mutated in place)")
    game.sync_ui()

def bst_grow(key):
    node = gardenTree.search(int(key))
    if node is None:
        say(f"Tile #{key} not found.")
        return
    node.crop.stage = min(node.crop.max_stage, node.crop.stage + 1)   # debug shortcut
    say(f"Tile #{key} {node.crop.species} is now stage {node.crop.stage}")
    game.sync_ui()

def bst_in_order():
    nodes = gardenTree.get_all_sorted()
    gardenTree.highlight = [n["key"] for n in nodes]
    updateBSTOutput("In-order (sorted by tile): " + " -> ".join(f"#{n['key']}" for n in nodes))

print(f"Topic 5 BST ready. It holds {gardenTree.size} plants and mirrors the garden grid.")
`
    },
    6: { title: "Topic 6: Hash Tables, Collisions, & Rehashing", code: `# Topic 6\n` },
    7: { title: "Topic 7: Graph Foundations & DFS/BFS", code: `# Topic 7\n` },
    8: { title: "Topic 8: Sorting Algorithms", code: `# Topic 8\n` }
};

// =====================================================================
// INITIALIZATION & DOM SETUP
// =====================================================================
window.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('version-badge').textContent = `v${APP_VERSION}`;
    lucide.createIcons();      // turn <i data-lucide> tags into SVG icons
    populateTopicDropdown();   // fill the code editor's topic list
    refreshTopicUI();          // draw the topic status chips
    initPyodideEngine();       // start loading Python (takes a few seconds)
});

function populateTopicDropdown() {
    const sel = document.getElementById('topic-selector');
    sel.innerHTML = '';
    for (let key in topicTemplates) {
        let opt = document.createElement('option');
        opt.value = key;
        opt.textContent = topicTemplates[key].title;
        sel.appendChild(opt);
    }
    loadTopic();
}

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

        // ORDER MATTERS:
        //   Topic 3 creates `game`,
        //   Topic 4 builds the ecosystem tree,
        //   Topic 2 creates `cq` (the climate queue) used by game.advance_day(),
        //   Topic 5 creates `gardenTree` (the BST the game plants into).
        await pyodideInstance.runPythonAsync(topicTemplates[3].code);
        await pyodideInstance.runPythonAsync(topicTemplates[4].code);
        await pyodideInstance.runPythonAsync(topicTemplates[2].code);
        await pyodideInstance.runPythonAsync(topicTemplates[5].code);

        syncFromBST();   // first draw of the grid + BST

        // These run silently to power the game; they are NOT marked activated.
        refreshTopicUI();
        setEngineStatus("ready", "Python ready");
        showToast("Welcome! Pick a seed, then click an empty tile to plant 🌱");
    } catch (err) {
        console.error("Failed to initialize Pyodide:", err);
        setEngineStatus("error", "Python failed to load");
    }
}

function setEngineStatus(state, text) {
    if (state === "error") showToast(text);
}

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

async function runPythonCode() {
    if (!pyodideInstance) {
        showToast("Pyodide is still loading...");
        return;
    }
    const code = document.getElementById("code-editor").value;
    const consoleBox = document.getElementById("output-console");
    consoleBox.innerText = "Running Python code...\n";

    try {
        pyodideInstance.setStdout({
            batched: (text) => {
                consoleBox.innerText += text + "\n";
            }
        });

        await pyodideInstance.runPythonAsync(code);
        syncFromBST();   // a re-run topic may have changed game / gardenTree

        const topicKey = document.getElementById('topic-selector').value;
        consoleBox.innerText += `\n✅ Topic ${topicKey} activated successfully.`;
        markTopicActivated(topicKey);
    } catch (err) {
        consoleBox.innerText += "\nExecution Error:\n" + err.toString();
        console.error("Pyodide Execution Error:", err);
    }
}

/**
 * Safely calls a method on the Python `game` object, then re-syncs the
 * grid and BST views from gardenTree.
 * Example: pyCall('handle_tile_click', 7, 'Maize') runs game.handle_tile_click(7,'Maize').
 */
function pyCall(func, ...args) {
    if (!pyodideInstance) {
        showToast("Python engine is still loading...");
        return;
    }
    try {
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
    } finally {
        syncFromBST();   // grid + BST always redrawn from gardenTree
    }
}

function triggerUndo() {
    pyCall('undo');
}

function runTreeTraversal(mode) {
    if (!pyodideInstance) return;
    try {
        pyodideInstance.runPython(`execute_traversal_mode('${mode}')`);
    } catch (err) {
        console.error("Traversal execution error:", err);
    }
}

// =====================================================================
// BST -> UI SYNC: gardenTree is the single source for grid AND BST views
// =====================================================================

// Evaluates a Python expression and returns plain JS (dicts -> objects),
// freeing the PyProxy so memory doesn't leak.
function fetchFromPython(expr) {
    const result = pyodideInstance.runPython(expr);
    if (result && typeof result.toJs === 'function') {
        const value = result.toJs({ dict_converter: Object.fromEntries });
        result.destroy();
        return value;
    }
    return result;
}

function syncFromBST() {
    if (!pyodideInstance) return;
    try {
        if (!pyodideInstance.runPython(`'gardenTree' in globals()`)) return;
        const sorted = fetchFromPython('gardenTree.get_all_sorted()');   // for the grid
        const tree = fetchFromPython('gardenTree.to_dict()');            // for the BST shape
        const highlight = fetchFromPython('gardenTree.highlight') || [];
        renderGridFromBST(sorted);
        renderBST(tree, highlight);
    } catch (err) {
        console.error("syncFromBST failed:", err);
    }
}

// Draws the 5x5 grid. Tile i shows the BST node whose key === i.
function renderGridFromBST(sortedNodes) {
    const gridEl = document.getElementById('garden-grid');
    gridEl.innerHTML = '';
    const byTile = new Map(sortedNodes.map(n => [n.key, n]));

    for (let idx = 0; idx < GRID_TILES; idx++) {
        const tile = byTile.get(idx);
        const div = document.createElement('div');
        div.className = "aspect-square rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all duration-150 p-1 relative select-none ";

        if (!tile) {
            div.className += "bg-[#1a1236]/80 border-emerald-900/40 hover:border-emerald-500/60 hover:bg-[#2a1d52]";
            div.innerHTML = `<span class="text-xs text-emerald-700/60 font-semibold">${idx}</span>`;
        } else {
            if (tile.is_mature)    div.className += "bg-amber-950/30 border-amber-500/60 hover:border-amber-400";
            else if (tile.watered) div.className += "bg-blue-950/30 border-blue-500/60 hover:border-blue-400";
            else                   div.className += "bg-emerald-950/40 border-emerald-700/50 hover:border-emerald-400";

            div.innerHTML = `
                <span class="text-2xl">${tile.emoji}</span>
                <span class="text-[10px] font-bold text-emerald-200 truncate w-full text-center">${tile.species}</span>
                ${tile.watered ? '<span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-400"></span>' : ''}
            `;
        }

        div.onclick = () => {
            const tileIndex = parseInt(idx, 10);                       // guarantees an integer
            const selectedCrop = document.getElementById('crop-selector').value;
            pyCall('handle_tile_click', tileIndex, selectedCrop);
        };
        gridEl.appendChild(div);
    }
}

// =====================================================================
// JAVASCRIPT / PYTHON INTEROP BRIDGE FUNCTIONS
// =====================================================================

function updateResources(water, seeds, energy, coins) {
    document.getElementById('water-text').textContent = `${water} / 200 L`;
    document.getElementById('water-bar').style.width = `${(water / 200) * 100}%`;

    document.getElementById('seeds-text').textContent = `${seeds} / 100`;
    document.getElementById('seeds-bar').style.width = `${(seeds / 100) * 100}%`;

    document.getElementById('energy-text').textContent = `${energy} / 120 Wh`;
    document.getElementById('energy-bar').style.width = `${(energy / 120) * 100}%`;

    document.getElementById('coins-text').textContent = `${coins} Coins`;
}

function updateHeaderStats(day, stewardship) {
    document.getElementById('day-counter').textContent = day;
    document.getElementById('stewardship-counter').textContent = `${stewardship}%`;
}

function addPlantsToDropdown(pyList) {
    const sel = document.getElementById('crop-selector');
    const currentVal = sel.value;   // remember the current choice
    sel.innerHTML = '';

    let jsArr = pyList.toJs ? pyList.toJs() : pyList;
    jsArr.forEach(item => {
        let opt = document.createElement('option');
        opt.value = item[0];                                        // species name
        opt.textContent = `${item[1]} ${item[0]} (${item[2]}c)`;    // "🌽 Maize (5c)"
        sel.appendChild(opt);
    });

    if (currentVal && Array.from(sel.options).some(o => o.value === currentVal)) {
        sel.value = currentVal;
    }
}

function pushAction(actionStr) {
    displayActionHistory.unshift(actionStr);
    if (displayActionHistory.length > 8) displayActionHistory.pop();

    const stackEl = document.getElementById('action-stack');
    stackEl.innerHTML = '';
    displayActionHistory.forEach((act, idx) => {
        const item = document.createElement('div');
        item.className = "bg-[#1c1438] border border-emerald-900/50 p-2 rounded-lg text-xs text-emerald-200 flex items-center justify-between";
        item.innerHTML = `<span>${act}</span> <span class="text-[9px] text-emerald-500 font-mono">#${displayActionHistory.length - idx}</span>`;
        stackEl.appendChild(item);
    });
}

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

function renderTreeHierarchy(pyTree) {
    let tree = pyTree.toJs ? pyTree.toJs({ dict_converter: Object.fromEntries }) : pyTree;
    const container = document.getElementById('tree-container');
    container.innerHTML = '';

    function buildNodeHTML(node) {
        let html = `<div class="flex flex-col items-center">
            <div class="tree-node bg-[#241a4a] border border-emerald-700/60 rounded-xl px-3 py-1.5 text-xs text-emerald-100 flex items-center gap-1.5 shadow-md">
                <span>${node.icon}</span>
                <span class="font-semibold">${node.name}</span>
            </div>`;

        if (node.children && node.children.length > 0) {
            html += `<div class="w-0.5 h-3 bg-emerald-700/50"></div>`;
            html += `<div class="flex gap-4 border-t border-emerald-700/50 pt-3">`;
            node.children.forEach(child => {
                html += buildNodeHTML(child);
            });
            html += `</div>`;
        }
        html += `</div>`;
        return html;
    }

    container.innerHTML = buildNodeHTML(tree);
}

function updateTraversalOutput(seqText) {
    document.getElementById('traversal-output').textContent = seqText;
}

function showToast(msg) {
    let toast = document.createElement('div');
    toast.className = "fixed bottom-5 right-5 bg-emerald-900 border border-emerald-500 text-emerald-100 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg z-50 transition-all duration-300";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ---------------- Topic 5: BST view ----------------
// Receives plain JS values (already converted by fetchFromPython).
function renderBST(tree, highlightKeys) {
    const hl = new Set(highlightKeys || []);
    const container = document.getElementById('bst-container');

    if (!tree) {
        container.innerHTML = '<span class="text-xs text-emerald-400/60 italic">The tree is empty. Plant something (tile 0-24)!</span>';
        return;
    }

    function buildNode(node) {
        if (!node) return '<div class="w-10"></div>';   // spacer for a missing child
        const border = hl.has(node.key) ? 'border-amber-400' : 'border-emerald-700/60';
        let html = `<div class="flex flex-col items-center">
            <div class="tree-node bg-[#241a4a] border ${border} rounded-xl px-2 py-1 text-[11px] text-emerald-100 text-center">
                <div class="font-bold">${node.emoji} Tile #${node.key}</div>
                <div>${node.species}</div>
                <div class="text-blue-300">${node.watered ? '💧 watered' : 'dry'} · S${node.stage}</div>
            </div>`;
        if (node.left || node.right) {
            html += `<div class="w-0.5 h-3 bg-emerald-700/50"></div>
                     <div class="flex gap-3 border-t border-emerald-700/50 pt-3">${buildNode(node.left)}${buildNode(node.right)}</div>`;
        }
        return html + '</div>';
    }
    container.innerHTML = buildNode(tree);
}

function updateBSTOutput(text) {
    document.getElementById('bst-output').textContent = text;
}

// Runs a Python function (not a game method) after checking gardenTree exists
function bstCall(func, ...args) {
    if (!pyodideInstance) { showToast("Python engine is still loading..."); return; }
    try {
        if (!pyodideInstance.runPython(`'gardenTree' in globals()`)) {
            showToast("gardenTree not found. Run Topic 5 first!");
            return;
        }
        const formatted = args.map(a => typeof a === 'string' ? JSON.stringify(a) : a).join(',');
        pyodideInstance.runPython(`${func}(${formatted})`);
    } catch (err) {
        console.error(`Error calling ${func}:`, err);
        showToast(`Execution Error: ${err.message}`);
    } finally {
        syncFromBST();
    }
}

// Reads the inputs on the BST tab and calls the matching Python function
function bstAction(action) {
    if (action === 'inorder') return bstCall('bst_in_order');

    const tileIndex = parseInt(document.getElementById('bst-key').value, 10);
    if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= GRID_TILES) {
        showToast(`Enter a tile index from 0 to ${GRID_TILES - 1}`);
        return;
    }
    const species = document.getElementById('bst-species').value;

    if (action === 'insert')      bstCall('bst_insert', tileIndex, species);
    else if (action === 'search') bstCall('bst_search', tileIndex);
    else if (action === 'delete') bstCall('bst_delete', tileIndex);
    else if (action === 'water')  bstCall('bst_water', tileIndex);
    else if (action === 'grow')   bstCall('bst_grow', tileIndex);
}

// =====================================================================
// UI NAVIGATION & TAB SWITCHING (4 tabs)
// =====================================================================
function switchTab(tab) {
    const on = "px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap bg-[#3b2a6b] text-emerald-100 flex items-center gap-1.5";
    const off = "px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap text-emerald-400/80 hover:text-emerald-100 flex items-center gap-1.5";
    ['game', 'code', 'tree', 'bst'].forEach(name => {
        document.getElementById('view-' + name).classList.toggle('hidden', name !== tab);
        document.getElementById('tab-' + name).className = name === tab ? on : off;
    });
}
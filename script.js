// =====================================================================
// script.js  -  ALL the JavaScript in one file
//   Part 1: global state + the 8 Python topics (stored as text)
//   Part 2: editor, Python bridge (pyCall), grid <-> BST sync, tabs
//   Part 3: isometric board, pests, shop, sounds, weather, fun effects
//   Part 4: landing page, sky, XP, missions, achievements
//   Part 5: start-up (runs when the page has loaded)
// =====================================================================

// ---------------------------------------------------------------------
// PART 1: GLOBAL STATE
// ---------------------------------------------------------------------
const APP_VERSION = "0.9.0";
const GRID_TILES = 25;             // 5 x 5, tile indexes 0-24
let pyodideInstance = null;        // set once Python has loaded
let displayActionHistory = [];     // last 8 actions shown in the history panel
const activatedTopics = new Set(); // topics that have been run

// =====================================================================
// THE 8 PYTHON TOPICS (Python code stored as JS template strings)
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

    // ---------------- TOPIC 6: Hash tables ----------------
    6: {
        title: "Topic 6: Hash Tables, Collisions, & Rehashing",
        code: `# Topic 6: Hash Tables, Collisions, & Rehashing
class HashTable:
    """Separate chaining. Doubles capacity (rehash) when load factor > 0.75."""
    def __init__(self, capacity=4):
        self.capacity = capacity
        self.size = 0
        self.buckets = [[] for _ in range(capacity)]
        self.collisions = 0

    def _index(self, key):
        return sum(ord(ch) for ch in key) % self.capacity

    def put(self, key, value):
        bucket = self.buckets[self._index(key)]
        for pair in bucket:
            if pair[0] == key:
                pair[1] = value
                return
        if bucket:
            self.collisions += 1
        bucket.append([key, value])
        self.size += 1
        if self.size / self.capacity > 0.75:
            self._rehash()

    def get(self, key):
        for k, v in self.buckets[self._index(key)]:
            if k == key:
                return v
        return None

    def _rehash(self):
        old = [pair for b in self.buckets for pair in b]
        self.capacity *= 2
        self.buckets = [[] for _ in range(self.capacity)]
        self.size = 0
        for k, v in old:
            self.put(k, v)

crop_values = HashTable()
for name, coins in [("Maize", 30), ("Tomato", 45), ("Wheat", 25), ("Carrot", 35), ("Pumpkin", 75), ("Sunflower", 55)]:
    crop_values.put(name, coins)
print(f"Topic 6: {crop_values.size} crops hashed, capacity {crop_values.capacity}, collisions {crop_values.collisions}")
print("Pumpkin yield lookup:", crop_values.get("Pumpkin"))
`
    },

    // ---------------- TOPIC 7: Graphs ----------------
    7: {
        title: "Topic 7: Graph Foundations & DFS/BFS",
        code: `# Topic 7: Graph Foundations & DFS/BFS
from collections import deque

garden_graph = {
    "Core": ["Hydro", "Solar"],
    "Hydro": ["Core", "Bed A", "Bed B"],
    "Solar": ["Core", "Greenhouse"],
    "Bed A": ["Hydro"],
    "Bed B": ["Hydro", "Greenhouse"],
    "Greenhouse": ["Solar", "Bed B"],
}

def graph_bfs(graph, start):
    """Level by level using a FIFO queue (how pests spread outward)."""
    seen, order, q = {start}, [], deque([start])
    while q:
        node = q.popleft()
        order.append(node)
        for nb in graph[node]:
            if nb not in seen:
                seen.add(nb)
                q.append(nb)
    return order

def graph_dfs(graph, node, seen=None):
    """Go as deep as possible first (recursion = call stack)."""
    if seen is None:
        seen = []
    seen.append(node)
    for nb in graph[node]:
        if nb not in seen:
            graph_dfs(graph, nb, seen)
    return seen

print("Topic 7 BFS:", " -> ".join(graph_bfs(garden_graph, "Core")))
print("Topic 7 DFS:", " -> ".join(graph_dfs(garden_graph, "Core")))
`
    },

    // ---------------- TOPIC 8: Sorting ----------------
    8: {
        title: "Topic 8: Sorting Algorithms",
        code: `# Topic 8: Sorting Algorithms
def bubble_sort(items):
    a = list(items)
    for i in range(len(a)):
        for j in range(len(a) - i - 1):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
    return a

def merge_sort(items):
    if len(items) <= 1:
        return list(items)
    mid = len(items) // 2
    left, right = merge_sort(items[:mid]), merge_sort(items[mid:])
    out = []
    while left and right:
        out.append(left.pop(0) if left[0] <= right[0] else right.pop(0))
    return out + left + right

def quick_sort(items):
    if len(items) <= 1:
        return list(items)
    pivot, rest = items[0], items[1:]
    return quick_sort([x for x in rest if x < pivot]) + [pivot] + quick_sort([x for x in rest if x >= pivot])

yields = [30, 45, 25, 35, 75, 55]
print("Topic 8 bubble O(n^2):", bubble_sort(yields))
print("Topic 8 merge  O(n log n):", merge_sort(yields))
print("Topic 8 quick  avg O(n log n):", quick_sort(yields))
`
    }
};

// =====================================================================
// PART 2: EDITOR, PYTHON BRIDGE, SYNC, TABS
// =====================================================================
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
    if (!pyodideInstance) { showToast("Pyodide is still loading..."); return; }
    const code = document.getElementById("code-editor").value;
    const consoleBox = document.getElementById("output-console");
    consoleBox.innerText = "Running Python code...\n";
    try {
        pyodideInstance.setStdout({ batched: (text) => { consoleBox.innerText += text + "\n"; } });
        await pyodideInstance.runPythonAsync(code);
        syncFromBST();
        const topicKey = document.getElementById('topic-selector').value;
        consoleBox.innerText += `\n✅ Topic ${topicKey} activated successfully.`;
        markTopicActivated(topicKey);
    } catch (err) {
        consoleBox.innerText += "\nExecution Error:\n" + err.toString();
        console.error("Pyodide Execution Error:", err);
    }
}

// Calls game.<func>(args) in Python, then redraws grid + BST.
function pyCall(func, ...args) {
    if (!pyodideInstance) { showToast("Python engine is still loading..."); return; }
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
        syncFromBST();
    }
}

function triggerUndo() { pyCall('undo'); }

function runTreeTraversal(mode) {
    if (!pyodideInstance) return;
    try { pyodideInstance.runPython(`execute_traversal_mode('${mode}')`); }
    catch (err) { console.error("Traversal execution error:", err); }
}

// Evaluates a Python expression and returns plain JS (frees the PyProxy).
function fetchFromPython(expr) {
    const result = pyodideInstance.runPython(expr);
    if (result && typeof result.toJs === 'function') {
        const value = result.toJs({ dict_converter: Object.fromEntries });
        result.destroy();
        return value;
    }
    return result;
}

// gardenTree is the single source for BOTH the grid and the BST view.
function syncFromBST() {
    if (!pyodideInstance) return;
    try {
        if (!pyodideInstance.runPython(`'gardenTree' in globals()`)) return;
        const sorted = fetchFromPython('gardenTree.get_all_sorted()');
        const tree = fetchFromPython('gardenTree.to_dict()');
        const highlight = fetchFromPython('gardenTree.highlight') || [];
        renderGridFromBST(sorted);
        renderBST(tree, highlight);
    } catch (err) {
        console.error("syncFromBST failed:", err);
    }
}

// ---- Bridge functions that Python calls (imported with "from js import ...") ----
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
    const currentVal = sel.value;
    sel.innerHTML = '';
    let jsArr = pyList.toJs ? pyList.toJs() : pyList;
    jsArr.forEach(item => {
        let opt = document.createElement('option');
        opt.value = item[0];
        opt.textContent = `${item[1]} ${item[0]} (${item[2]}c)`;
        sel.appendChild(opt);
    });
    if (currentVal && Array.from(sel.options).some(o => o.value === currentVal)) sel.value = currentVal;
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
    function buildNodeHTML(node) {
        let html = `<div class="flex flex-col items-center">
            <div class="tree-node bg-[#241a4a] border border-emerald-700/60 rounded-xl px-3 py-1.5 text-xs text-emerald-100 flex items-center gap-1.5 shadow-md">
                <span>${node.icon}</span><span class="font-semibold">${node.name}</span>
            </div>`;
        if (node.children && node.children.length > 0) {
            html += `<div class="w-0.5 h-3 bg-emerald-700/50"></div><div class="flex gap-4 border-t border-emerald-700/50 pt-3">`;
            node.children.forEach(child => { html += buildNodeHTML(child); });
            html += `</div>`;
        }
        return html + `</div>`;
    }
    container.innerHTML = buildNodeHTML(tree);
}

function updateTraversalOutput(seqText) {
    document.getElementById('traversal-output').textContent = seqText;
}

// Toast pop-up. Weather messages from Python also trigger a weather animation.
function showToast(msg) {
    let toast = document.createElement('div');
    toast.className = "fixed bottom-5 right-5 bg-emerald-900 border border-emerald-500 text-emerald-100 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg z-50 transition-all duration-300";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2500);

    if (typeof msg === 'string' && msg.startsWith('Climate:')) {
        if (msg.includes('Solar Flare')) weatherFx('sun');
        else if (msg.includes('Drought') || msg.includes('Heatwave')) weatherFx('dust');
        else if (msg.includes('Rain')) weatherFx('rain');
    }
}

function renderBST(tree, highlightKeys) {
    const hl = new Set(highlightKeys || []);
    const container = document.getElementById('bst-container');
    if (!tree) {
        container.innerHTML = '<span class="text-xs text-emerald-400/60 italic">The tree is empty. Plant something (tile 0-24)!</span>';
        return;
    }
    function buildNode(node) {
        if (!node) return '<div class="w-10"></div>';
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

function bstCall(func, ...args) {
    if (!pyodideInstance) { showToast("Python engine is still loading..."); return; }
    try {
        if (!pyodideInstance.runPython(`'gardenTree' in globals()`)) { showToast("gardenTree not found!"); return; }
        const formatted = args.map(a => typeof a === 'string' ? JSON.stringify(a) : a).join(',');
        pyodideInstance.runPython(`${func}(${formatted})`);
    } catch (err) {
        console.error(`Error calling ${func}:`, err);
        showToast(`Execution Error: ${err.message}`);
    } finally {
        syncFromBST();
    }
}

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

function switchTab(tab) {
    const on = "px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap bg-[#3b2a6b] text-emerald-100 flex items-center gap-1.5";
    const off = "px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap text-emerald-400/80 hover:text-emerald-100 flex items-center gap-1.5";
    ['game', 'code', 'tree', 'bst'].forEach(name => {
        document.getElementById('view-' + name).classList.toggle('hidden', name !== tab);
        document.getElementById('tab-' + name).className = name === tab ? on : off;
    });
}

// =====================================================================
// PART 3: ISOMETRIC BOARD, PESTS, SHOP, SOUNDS, WEATHER, FUN EFFECTS
// =====================================================================

// ---------------- Audio ----------------
let ac = null;
function tone(f, t0, d, type = 'sine', v = .15, f2) {
    try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        if (ac.state === 'suspended') ac.resume();
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
        o.type = type; o.frequency.setValueAtTime(f, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d);
    } catch (e) { /* audio blocked: ignore */ }
}
const SFX = {
    harvest: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .07, .2, 'triangle', .2)),
    water: () => { tone(900, 0, .12, 'sine', .18, 400); tone(700, .1, .12, 'sine', .15, 300); tone(1000, .2, .1, 'sine', .12, 500); },
    plant: () => tone(300, 0, .15, 'square', .08, 650),
    pest: () => { tone(200, 0, .08, 'sawtooth', .12); tone(120, .07, .1, 'sawtooth', .1); },
    buy: () => { tone(660, 0, .1, 'square', .09); tone(880, .1, .15, 'square', .09); },
    alert: () => tone(180, 0, .25, 'sawtooth', .1)
};

// ---------------- Floating text ----------------
function floatAt(idx, text, color, delay = 0) {
    setTimeout(() => {
        const el = idx == null ? document.getElementById('garden-grid')
            : document.querySelector(`.iso-tile[data-idx="${idx}"] .top`);
        if (!el) return;
        const r = el.getBoundingClientRect();
        const d = document.createElement('div');
        d.className = 'float-text';
        d.textContent = text;
        d.style.color = color;
        d.style.left = (r.left + r.width / 2) + 'px';
        d.style.top = (r.top + r.height / 2) + 'px';
        document.body.appendChild(d);
        setTimeout(() => d.remove(), 1300);
    }, delay);
}

// ---------------- Realistic crop drawings (6 crops x 3 growth stages) ----------------
const OL = 'stroke="#1e3a14" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"';
const cLeaf = (d, f) => `<path d="${d}" fill="${f}" ${OL}/>`;
const cStem = (d, w = 3, c = '#5aa532') =>
    `<path d="${d}" fill="none" stroke="#1e3a14" stroke-width="${w + 1.6}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
const cEll = (x, y, rx, ry, f, rot = 0, extra = OL) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" ${extra} transform="rotate(${rot} ${x} ${y})"/>`;
const THIN = 'stroke="#1e3a14" stroke-width="1"';

// feathery carrot top: one thin stem with small leaflets
function cFrond(x0, y0, x1, y1, col) {
    let s = cStem(`M${x0} ${y0} L${x1} ${y1}`, 1.3, '#3f8f2a');
    const a = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
    for (const t of [0.4, 0.62, 0.85, 1]) {
        const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
        s += cEll(px, py, 4.2, 1.7, col, a + 38, THIN) + cEll(px, py, 4.2, 1.7, col, a - 38, THIN);
    }
    return s;
}

// Stage 1 (all crops): a tiny sprout. Grasses get blades, carrot gets fine fronds.
function seedlingSvg(sp) {
    let g;
    if (sp === 'Maize' || sp === 'Wheat') {
        g = cLeaf('M30 66 C27 58 22 52 17 47 C25 50 29 56 30 66Z', '#6fcf3f') +
            cLeaf('M30 66 C33 56 38 50 43 45 C36 51 32 58 30 66Z', '#5cb338') +
            cLeaf('M30 66 C29 56 29 50 31 42 C33 50 33 58 30 66Z', '#4caf2a');
    } else if (sp === 'Carrot') {
        g = cFrond(30, 66, 22, 48, '#6fcf3f') + cFrond(30, 66, 38, 50, '#5cb338') + cFrond(30, 66, 30, 44, '#4caf2a');
    } else {
        g = cStem('M30 66 V52', 2.4) +
            cLeaf('M30 54 C20 54 13 47 16 40 C25 40 30 46 30 54Z', '#6fcf3f') +
            cLeaf('M30 54 C40 54 47 47 44 40 C35 40 30 46 30 54Z', '#4caf2a');
    }
    return `<svg viewBox="0 0 60 70">${g}</svg>`;
}

// ---- Maize: tall stalk, long arching leaves, golden cob in a husk, tassel on top ----
function maizeSvg(stage) {
    let g = cStem('M30 67 V16', 3.4, '#6bb23a');
    g += cLeaf('M30 58 C18 57 9 49 5 40 C16 44 26 49 30 54Z', '#5cb338');
    g += cLeaf('M30 48 C42 46 51 38 55 29 C44 33 35 38 30 43Z', '#4caf2a');
    g += cLeaf('M30 38 C20 36 14 29 11 21 C20 25 27 30 30 34Z', '#6fcf3f');
    if (stage === 2) return g + cLeaf('M30 28 C37 26 41 21 42 15 C36 18 32 21 30 24Z', '#5cb338');
    g += `<path d="M30 17 L25 6 M30 17 L30 4 M30 17 L35 6" fill="none" stroke="#d4a93a" stroke-width="1.7" stroke-linecap="round"/>`;
    g += `<g transform="rotate(16 38 38)">` + cEll(38, 37, 5.4, 11.5, '#ffd23f') +
        `<path d="M35.4 28 V47 M38 26 V48 M40.6 28 V47 M33.5 34 H42.5 M33.3 39 H42.7" stroke="#d99a00" stroke-width=".8" fill="none"/>` +
        cLeaf('M31.6 46 C31.4 42 35 40 38 39.5 C41 40 44.6 42 44.4 46 C42 53 34 53 31.6 46Z', '#8bc34a') + `</g>`;
    return g;
}

// ---- Tomato: staked vine with jagged leaves, green fruit then ripe red tomatoes ----
function tomatoFruit(x, y, r, red) {
    const col = red ? '#e53935' : '#8bc34a';
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" ${OL}/>` +
        (red ? `<ellipse cx="${x - r * .35}" cy="${y - r * .35}" rx="${r * .28}" ry="${r * .18}" fill="#fff" opacity=".6" transform="rotate(-35 ${x - r * .35} ${y - r * .35})"/>` : '') +
        `<path d="M${x - r * .6} ${y - r * .75} L${x} ${y - r * .45} L${x + r * .6} ${y - r * .75} L${x + r * .25} ${y - r * 1.05} L${x} ${y - r * .85} L${x - r * .25} ${y - r * 1.05}Z" fill="#43a047" stroke="#1e3a14" stroke-width="1"/>`;
}
function tomatoSvg(stage) {
    let g = `<path d="M47 67 V8" stroke="#8d6e3f" stroke-width="2.6" stroke-linecap="round"/>`;
    g += cStem('M30 67 C29 54 31 40 30 20', 2.8, '#4f9a2c');
    g += cLeaf('M30 60 L21 61 L17 56 L11 57 L13 51 L18 51 L21 46 L27 50Z', '#4caf2a');
    g += cLeaf('M30 50 L39 50 L43 45 L49 46 L47 40 L42 40 L39 35 L33 39Z', '#5cb338');
    g += cLeaf('M30 38 L22 37 L19 32 L13 32 L16 26 L21 27 L24 22 L28 28Z', '#6fcf3f');
    g += cLeaf('M30 26 L37 24 L40 19 L45 19 L44 13 L38 14 L35 10 L31 16Z', '#4caf2a');
    if (stage === 2) return g + tomatoFruit(23, 47, 4.5, false) + `<circle cx="37" cy="30" r="2.8" fill="#ffe135" ${OL}/>`;
    return g + tomatoFruit(21, 46, 7.5, true) + tomatoFruit(39, 34, 8, true) + tomatoFruit(33, 57, 6.5, true);
}

// ---- Wheat: three slender stalks; green while growing, golden ears with awns when ripe ----
function wheatSvg(stage) {
    const ripe = stage === 3, stalkC = ripe ? '#d9b04a' : '#7cb342', grainC = ripe ? '#f2c94c' : '#9ccc65';
    const G = 'stroke="#7a5d12" stroke-width=".9"';
    let g = '';
    [[19, 20], [30, 12], [41, 18]].forEach(([x, top], i) => {
        const n = ripe ? 6 : 4, step = 3.6, d = i === 1 ? -1 : 1;
        g += cStem(`M${x} 67 C${x + (i - 1) * 1.5} 50 ${x} 40 ${x} ${top + n * step}`, 1.8, stalkC);
        g += cLeaf(`M${x} 60 C${x + 8 * d} 56 ${x + 12 * d} 50 ${x + 13 * d} 42 C${x + 8 * d} 48 ${x + 3 * d} 52 ${x} 56Z`, ripe ? '#c8b04a' : '#6fcf3f');
        for (let k = 0; k < n; k++) {
            const y = top + k * step;
            g += cEll(x - 2.5, y, 1.7, 3, grainC, -28, G) + cEll(x + 2.5, y, 1.7, 3, grainC, 28, G);
        }
        g += cEll(x, top - 2, 1.6, 3, grainC, 0, G);
        if (ripe) g += `<path d="M${x - 2} ${top} L${x - 5} ${top - 8} M${x} ${top - 3} L${x} ${top - 11} M${x + 2} ${top} L${x + 5} ${top - 8}" stroke="#b8902e" stroke-width=".8" fill="none"/>`;
    });
    return g;
}

// ---- Carrot: feathery green tops; ripe carrot shows its orange shoulder above the soil ----
function carrotSvg(stage) {
    let g = '';
    const tips = stage === 2 ? [[19, 40], [30, 30], [41, 41]] : [[15, 38], [22, 24], [30, 17], [38, 24], [45, 38]];
    const cols = ['#4caf2a', '#5cb338', '#6fcf3f', '#5cb338', '#4caf2a'];
    if (stage === 3) g += `<path d="M20 63 C20 55 40 55 40 63 C40 67 35 71 30 71 C25 71 20 67 20 63Z" fill="#ff8a1f" ${OL}/><path d="M24 60 H36 M25 65 H35" stroke="#c75a00" stroke-width="1" fill="none"/>`;
    tips.forEach(([x, y], i) => { g += cFrond(30, stage === 3 ? 58 : 64, x, y, cols[stage === 2 ? i * 2 : i]); });
    return g;
}

// ---- Pumpkin: sprawling vine, big lobed leaves, ribbed orange pumpkin with a woody stem ----
function pumpLeaf(x, y, s, f = '#4caf2a') {
    return `<g transform="translate(${x} ${y}) scale(${s})">` +
        cLeaf('M0 0 C-10 2 -20 -4 -18 -12 C-23 -18 -15 -25 -9 -21 C-8 -29 8 -29 9 -21 C15 -25 23 -18 18 -12 C20 -4 10 2 0 0Z', f) +
        `<path d="M0 0 V-18 M0 -6 L-9 -14 M0 -6 L9 -14" stroke="#2e6b1f" stroke-width="1" fill="none"/></g>`;
}
function pumpkinSvg(stage) {
    let g = cStem('M30 67 C28 60 20 58 14 52', 2, '#5aa532') + cStem('M30 67 C32 58 38 56 42 50', 2, '#5aa532');
    if (stage === 2) {
        g += pumpLeaf(16, 50, .8) + pumpLeaf(41, 50, .9, '#5cb338');
        return g + `<ellipse cx="30" cy="59" rx="8" ry="6" fill="#9ccc65" ${OL}/><path d="M30 53 V49" stroke="#6d4c1f" stroke-width="2.2" stroke-linecap="round"/>`;
    }
    g += pumpLeaf(11, 46, .9) + pumpLeaf(50, 40, .8, '#5cb338');
    g += `<ellipse cx="30" cy="52" rx="22" ry="15" fill="#f57c00" ${OL}/>` +
        `<path d="M30 37.5 C22 42 22 62 30 66.5 C38 62 38 42 30 37.5Z" fill="#ff9a1f" stroke="#b25400" stroke-width="1.1"/>` +
        `<path d="M21 39 C12 44 14 60 21 65 M39 39 C48 44 46 60 39 65" fill="none" stroke="#b25400" stroke-width="1.1"/>` +
        `<path d="M30 38 C29 32 31 28 33 25" fill="none" stroke="#6d4c1f" stroke-width="3.6" stroke-linecap="round"/>` +
        `<path d="M35 31 C43 28 46 36 40 36" fill="none" stroke="#5aa532" stroke-width="1.4"/>`;
    return g;
}

// ---- Sunflower: tall thick stem, big leaves, green bud, then a big yellow flower with seed spiral ----
function sunflowerSvg(stage) {
    let g = cStem('M30 67 V24', 4.4, '#4f8f2a');
    g += cLeaf('M30 58 C19 60 10 54 9 45 C19 45 27 49 30 58Z', '#4caf2a');
    g += cLeaf('M30 47 C41 49 50 43 51 34 C41 34 33 38 30 47Z', '#5cb338');
    if (stage === 2) {
        return g + `<circle cx="30" cy="21" r="8" fill="#6fae35" ${OL}/><path d="M22 20 L18 14 L26 16Z M38 20 L42 14 L34 16Z M30 13 L27 6 L33 6Z" fill="#4f8f2a" ${OL}/><circle cx="30" cy="22" r="3.4" fill="#d4c43a"/>`;
    }
    for (const [off, col] of [[11.25, '#ffb300'], [0, '#ffd600']]) {
        for (let i = 0; i < 16; i++) g += `<ellipse cx="30" cy="9" rx="3.4" ry="7.5" fill="${col}" stroke="#a66a00" stroke-width=".8" transform="rotate(${i * 22.5 + off} 30 21)"/>`;
    }
    g += `<circle cx="30" cy="21" r="8.6" fill="#5d3a1a" ${OL}/>`;
    for (let k = 0; k < 22; k++) {
        const r = 1.55 * Math.sqrt(k + 1.5), a = k * 2.399963;
        g += `<circle cx="${(30 + r * Math.cos(a)).toFixed(1)}" cy="${(21 + r * Math.sin(a)).toFixed(1)}" r=".8" fill="#2d1a0b"/>`;
    }
    return g;
}

function plantSvg(stage, species) {
    if (stage === 1) return seedlingSvg(species);
    const draw = { Maize: maizeSvg, Tomato: tomatoSvg, Wheat: wheatSvg, Carrot: carrotSvg, Pumpkin: pumpkinSvg, Sunflower: sunflowerSvg }[species] || tomatoSvg;
    return `<svg viewBox="0 0 60 70">${draw(stage)}</svg>`;
}

// ---------------- Pests ----------------
const pests = new Map();             // tile index -> {type, age}
const stageMemory = new Map();       // tile index -> last drawn stage (for grow animation)
const rnd = n => Math.floor(Math.random() * n);
const runPy = code => pyodideInstance.runPython(code);
const plantedSet = () => new Set(fetchFromPython('gardenTree.get_all_sorted()').map(n => n.key));

function spawnPest() {
    if (pests.size >= 8) return;
    const planted = plantedSet();
    const crops = [...planted].filter(i => !pests.has(i));
    if (!crops.length) return;
    const i = crops[rnd(crops.length)];
    pests.set(i, { type: 'bug', age: 0 });
    SFX.alert();
    showToast(`🐛 A bug is eating tile ${i}! Click it!`);
}

function removePest(i) {
    pests.delete(i);
    const reward = 5;
    SFX.pest();
    runPy(`game.coins += ${reward}\ngame.sync_ui()`);
    syncFromBST();
    floatAt(i, 'Bug squashed!', '#ffffff');
    floatAt(i, `+${reward} Coins`, '#32CD32', 180);
}

function pestsPreDay() {
    const planted = plantedSet();
    for (const [i, p] of [...pests]) {
        p.age++;
        if (p.type === 'bug') {
            if (!planted.has(i)) { pests.delete(i); continue; }
            if (p.age >= 3) {
                runPy(`game.remove_tile(${i})`);
                pests.delete(i);
                showToast(`🐛 Bugs destroyed the crop on tile ${i}!`);
                floatAt(i, 'Crop eaten!', '#ff5252');
            }
        }
    }
}

// ---------------- Automation shop ----------------
const owned = { sprinkler: 0, solar: 0 };
const COST = { sprinkler: 40, solar: 60 }, MAXOWN = 5;
let autoWatered = [];

function buyUpgrade(kind) {
    if (!pyodideInstance) return showToast("Python engine is still loading...");
    if (owned[kind] >= MAXOWN) return showToast("Max level reached!");
    const coins = fetchFromPython('game.coins');
    if (coins < COST[kind]) return showToast(`Need ${COST[kind]} coins!`);
    runPy(`game.coins -= ${COST[kind]}\ngame.sync_ui()`);
    owned[kind]++;
    SFX.buy();
    updateShop();
    syncFromBST();
    floatAt(null, `-${COST[kind]} Coins`, '#ff5252');
    showToast(kind === 'sprinkler' ? '💦 Sprinkler installed: waters 4 crops each dawn' : '☀️ Solar panel installed: +10 Wh each dawn');
}

function updateShop() {
    document.getElementById('shop-sprinkler').textContent = `${owned.sprinkler}/${MAXOWN} · ${COST.sprinkler}c`;
    document.getElementById('shop-solar').textContent = `${owned.solar}/${MAXOWN} · ${COST.solar}c`;
}

function autoWaterNow() {
    autoWatered = [];
    if (!owned.sprinkler) return;
    const res = fetchFromPython(`_w = []
_n = ${owned.sprinkler * 4}
for _r in range(game.rows):
    for _c in range(game.cols):
        _cr = game.grid[_r][_c]
        if _n > 0 and _cr and not _cr.watered and _cr.stage < _cr.max_stage:
            _cr.watered = True
            _n -= 1
            _w.append(_r * game.cols + _c)
_w`);
    autoWatered = Array.from(res || []);
}

// ---------------- Weather overlay ----------------
function weatherFx(kind) {
    const fx = document.getElementById('weather-fx');
    if (!fx) return;
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;inset:0';
    if (kind === 'sun') {
        box.innerHTML = '<div class="sun-rays"></div><div class="sun-core"></div>';
    } else {
        for (let i = 0; i < 45; i++) {
            const p = document.createElement('div');
            if (kind === 'dust') {
                const s = 3 + rnd(5);
                p.className = 'dust';
                p.style.cssText = `left:${rnd(100)}%;top:${rnd(100)}%;width:${s}px;height:${s}px;--dx:${120 + rnd(200)}px;--dy:${rnd(80) - 40}px;animation-duration:${3 + rnd(3)}s;animation-delay:${rnd(2000)}ms`;
            } else {
                p.className = 'drop';
                p.style.cssText = `left:${rnd(100)}%;animation-duration:${.8 + Math.random()}s;animation-delay:${rnd(2500)}ms;animation-iteration-count:2`;
            }
            box.appendChild(p);
        }
    }
    fx.appendChild(box);
    setTimeout(() => box.remove(), 8000);
}

// ---------------- Isometric grid renderer ----------------
function renderGridFromBST(sortedNodes) {
    const gridEl = document.getElementById('garden-grid');
    gridEl.innerHTML = '';
    const byTile = new Map(sortedNodes.map(n => [n.key, n]));

    for (let idx = 0; idx < GRID_TILES; idx++) {
        const t = byTile.get(idx), pest = pests.get(idx);
        const div = document.createElement('div');
        div.className = 'iso-tile' + (t ? ' has-crop' : '') + (t && t.watered ? ' watered' : '') + (t && t.is_mature ? ' mature' : '');
        div.dataset.idx = idx;

        let html = `<div class="top"><span class="idx${t ? ' tag' : ''}">${idx}</span></div><div class="sf"></div><div class="sr"></div>`;
        if (t) {
            const prev = stageMemory.get(idx);
            const grow = (prev === undefined || t.stage > prev) ? ' grow' : '';
            stageMemory.set(idx, t.stage);
            html += `<div class="plant${grow}">${plantSvg(t.stage, t.species)}</div>`;
        } else {
            stageMemory.delete(idx);
        }
        if (pest) html += `<div class="pest ${pest.type}">🐛</div>`;
        div.innerHTML = html;

        div.onclick = () => pyCall('handle_tile_click', idx, document.getElementById('crop-selector').value);
        gridEl.appendChild(div);
    }
}

// ---------------- pyCall wrapper #1: pests, automation, FX, sound ----------------
const _pyCall = window.pyCall;
const snap = () => { try { return fetchFromPython('[game.coins, game.water, game.energy]'); } catch (e) { return null; } };

window.pyCall = function (func, ...args) {
    if (!pyodideInstance) return _pyCall(func, ...args);
    let tile = null;
    if (func === 'handle_tile_click') {
        tile = args[0];
        if (pests.has(tile)) return removePest(tile);
    }
    if (func === 'advance_day') { pestsPreDay(); autoWaterNow(); }
    const before = snap();
    _pyCall(func, ...args);
    if (func === 'advance_day') {
        if (Math.random() < .7) spawnPest();
        if (Math.random() < .3) spawnPest();
        if (owned.solar) runPy(`game.energy = min(120, game.energy + ${owned.solar * 10})\ngame.sync_ui()`);
        syncFromBST();
        dayBanner();
        autoWatered.forEach((i, k) => floatAt(i, '💦 Auto-water', '#4fc3ff', k * 120));
    }
    const after = snap();
    if (!before || !after) return;

    const [dc, dw, de] = [after[0] - before[0], after[1] - before[1], after[2] - before[2]];
    let k = 0;
    const pop = (txt, col) => floatAt(tile, txt, col, 160 * k++);
    if (dc > 0) pop(`+${dc} Coins`, '#32CD32');
    else if (dc < 0 && func === 'handle_tile_click') pop(`${dc} Coins`, '#ff5252');
    if (dw > 0) pop(`+${dw}L Water`, '#4fc3ff');
    else if (dw < 0) pop(`${dw}L Water`, '#2979ff');
    if (de > 0) pop(`+${de} Wh`, '#ffd600');

    if (func === 'handle_tile_click' && tile != null) {
        if (dc > 0) { SFX.harvest(); confetti(tile); } else if (dw < 0) SFX.water(); else if (dc < 0) SFX.plant();
        const pl = document.querySelector(`.iso-tile[data-idx="${tile}"] .plant`);
        if (pl) { pl.classList.remove('grow'); void pl.offsetWidth; pl.classList.add('squish'); }
    } else if (func === 'water_all' && dw < 0) SFX.water();
};

// ---------------- Fun pack: confetti, day banner, counter bumps, leaves ----------------
function confetti(idx) {
    const el = document.querySelector(`.iso-tile[data-idx="${idx}"] .top`);
    if (!el) return;
    const r = el.getBoundingClientRect(), cols = ['#32CD32', '#7FFF00', '#ffd600', '#ff5252', '#4fc3ff', '#ff7ae0'];
    for (let i = 0; i < 26; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        const ang = Math.random() * Math.PI * 2, dist = 50 + rnd(90);
        c.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;background:${cols[rnd(cols.length)]};` +
            `--x:${Math.cos(ang) * dist}px;--y:${Math.sin(ang) * dist - 40}px;--r:${rnd(720)}deg`;
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 1000);
    }
}

function dayBanner() {
    const day = document.getElementById('day-counter').textContent;
    const b = document.createElement('div');
    b.className = 'day-banner';
    b.innerHTML = `<span>☀️</span> Day ${day}`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 1700);
}

function bump(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}
const _uRes = window.updateResources, _uHdr = window.updateHeaderStats;
let _lastCoins = null, _lastDay = null, _lastScore = null;
window.updateResources = function (w, s, e, c) {
    _uRes(w, s, e, c);
    if (_lastCoins !== null && c !== _lastCoins) bump('coins-text');
    _lastCoins = c;
};
window.updateHeaderStats = function (d, sc) {
    _uHdr(d, sc);
    if (_lastDay !== null && d !== _lastDay) bump('day-counter');
    if (_lastScore !== null && sc !== _lastScore) bump('stewardship-counter');
    _lastDay = d; _lastScore = sc;
};

// gentle falling leaves behind the UI
(function () {
    const layer = document.createElement('div');
    layer.className = 'leaf-layer';
    const icons = ['🍃', '🌿', '✨', '🍀', '🌸'];
    for (let i = 0; i < 14; i++) {
        const l = document.createElement('span');
        l.className = 'leaf';
        l.textContent = icons[rnd(icons.length)];
        l.style.cssText = `left:${rnd(100)}%;font-size:${12 + rnd(14)}px;animation-duration:${12 + rnd(14)}s;animation-delay:${-rnd(20)}s`;
        layer.appendChild(l);
    }
    document.body.appendChild(layer);
})();

// =====================================================================
// PART 4: LANDING PAGE, SKY, XP, MISSIONS, ACHIEVEMENTS
// =====================================================================
(function () {
    const $ = id => document.getElementById(id);
    const S = { harvest: 0, water: 0, plant: 0, bug: 0, days: 0, xp: 0, level: 1, ach: {}, act: null };
    try { Object.assign(S, JSON.parse(localStorage.getItem('garden_v3') || '{}')); } catch (e) { }
    const save = () => { try { localStorage.setItem('garden_v3', JSON.stringify(S)); } catch (e) { } };
    const py = () => fetchFromPython('[game.coins, game.water, len(gardenTree.get_all_sorted())]');
    let lastCoins = 0;

    // ============ LANDING PAGE + LOADING SCREEN ============
    const intro = document.createElement('div');
    intro.className = 'intro';
    intro.innerHTML = `
        ${['🌽', '🍅', '🎃', '🌻', '🥕', '🦋', '☀️', '💧'].map((e, i) => `<span class="intro-float" style="left:${8 + i * 12}%;top:${i % 2 ? 12 : 78}%;animation-delay:${-i}s">${e}</span>`).join('')}
        <h1>Python-Based<br>Garden Simulator</h1>
        <p>Grow a glowing sanctuary, beat the bugs, unlock automation, and learn data structures with real Python running in your browser.</p>
        <div class="chips3"><span>SDG 2 · Zero Hunger</span><span>SDG 13 · Climate Action</span><span>SDG 15 · Life on Land</span></div>
        <div class="feat">
            <div><b>🌱</b>Plant, water &amp; harvest 3-phase crops</div>
            <div><b>🐛</b>Squash bugs before they eat crops</div>
            <div><b>⚙️</b>Buy sprinklers &amp; solar panels</div>
            <div><b>🏆</b>Missions, XP levels &amp; achievements</div>
            <div><b>🌙</b>Day and night sky cycle</div>
            <div><b>🧠</b>8 live data-structure topics</div>
        </div>
        <div class="prog"><i id="intro-bar"></i></div>
        <div id="intro-msg">Waking up the garden…</div>
        <button id="start-go">Loading…</button>`;
    document.body.appendChild(intro);
    const setProg = (p, m) => { $('intro-bar').style.width = p + '%'; $('intro-msg').textContent = m; };
    $('start-go').onclick = () => {
        intro.classList.add('out'); SFX.buy(); setTimeout(() => intro.remove(), 800);
        setTimeout(() => bigBanner('🌱 Welcome, Gardener!'), 400);
    };

    // Starts Python, runs all 8 topics, and reports progress to the loading bar.
    window.initPyodideEngine = async function () {
        const box = $('output-console');
        try {
            setProg(6, 'Loading the Python engine…');
            pyodideInstance = await loadPyodide();
            pyodideInstance.setStdout({ batched: t => { box.innerText += t + "\n"; } });
            box.innerText = '';
            // Order matters: 3 makes `game`, 2 makes `cq`, 5 makes `gardenTree`.
            const order = [1, 3, 4, 2, 5, 6, 7, 8];
            for (let n = 0; n < order.length; n++) {
                const k = order[n];
                setProg(25 + n * 9, `Running Topic ${k}: ${topicTemplates[k].title.split(': ')[1]}`);
                await new Promise(r => setTimeout(r, 40));
                await pyodideInstance.runPythonAsync(topicTemplates[k].code);
                activatedTopics.add(String(k));
                box.innerText += `✅ Topic ${k} running\n`;
            }
            displayActionHistory.length = 0; $('action-stack').innerHTML = '';
            syncFromBST(); refreshTopicUI(); lastCoins = py()[0]; renderXP(); renderPanel(); skyUpdate();
            setProg(100, 'Garden ready!');
            $('start-go').textContent = '▶ Start Gardening'; $('start-go').classList.add('ready');
        } catch (err) {
            console.error(err); setProg(100, 'Python failed to load. Refresh the page.');
        }
    };

    function bigBanner(t) {
        const b = document.createElement('div'); b.className = 'day-banner'; b.textContent = t;
        document.body.appendChild(b); setTimeout(() => b.remove(), 1700);
    }

    // ============ XP, MISSIONS, ACHIEVEMENTS ============
    const POOL = [
        { t: 'Harvest 3 crops', k: 'harvest', n: 3, r: 30 }, { t: 'Water 6 times', k: 'water', n: 6, r: 20 },
        { t: 'Plant 4 seeds', k: 'plant', n: 4, r: 20 }, { t: 'Squash 2 bugs', k: 'bug', n: 2, r: 25 },
        { t: 'Survive 3 days', k: 'days', n: 3, r: 25 }, { t: 'Harvest 8 crops', k: 'harvest', n: 8, r: 60 },
        { t: 'Water 15 times', k: 'water', n: 15, r: 35 }, { t: 'Plant 10 seeds', k: 'plant', n: 10, r: 40 },
        { t: 'Squash 5 bugs', k: 'bug', n: 5, r: 50 }, { t: 'Survive 6 days', k: 'days', n: 6, r: 45 },
        { t: 'Buy an upgrade', k: 'buy', n: 1, r: 40 }, { t: 'Buy 3 upgrades', k: 'buy', n: 3, r: 90 }];
    // always keep 4 missions active
    if (!Array.isArray(S.act)) S.act = [];
    for (let i = 0; S.act.length < 4 && i < POOL.length; i++) {
        if (!S.act.some(o => o.i === i)) S.act.push({ i, from: S[POOL[i].k] || 0 });
    }
    const ACH = [
        ['first', '🌾 First Harvest', () => S.harvest >= 1], ['farmer', '🧺 Farmer (10)', () => S.harvest >= 10],
        ['pro', '🚜 Pro Farmer (30)', () => S.harvest >= 30], ['bug', '🐞 Bug Buster (5)', () => S.bug >= 5],
        ['bug2', '🕷️ Exterminator (20)', () => S.bug >= 20], ['green', '🌱 Green Thumb (15)', () => S.plant >= 15],
        ['green2', '🌳 Forester (40)', () => S.plant >= 40], ['water', '💧 Water Master (50)', () => S.water >= 50],
        ['surv', '📅 Survivor (10 days)', () => S.days >= 10], ['surv2', '🗓️ Veteran (30 days)', () => S.days >= 30],
        ['auto', '⚙️ Automated', () => owned.sprinkler > 0 || owned.solar > 0], ['upg', '🔧 Upgrader (5 buys)', () => (S.buy || 0) >= 5],
        ['lvl', '⭐ Level 5', () => S.level >= 5], ['rich', '🪙 Tycoon (500c)', () => lastCoins >= 500]];

    function giveCoins(n) { try { runPy(`game.coins += ${n}\ngame.sync_ui()`); syncFromBST(); lastCoins += n; } catch (e) { } }
    function evt(k, n = 1) {
        S[k] = (S[k] || 0) + n;
        gainXP((({ harvest: 10, plant: 2, water: 1, bug: 3, days: 1, buy: 5 })[k] || 0) * n);
        S.act.forEach(a => {
            const m = POOL[a.i];
            if ((S[m.k] || 0) - a.from >= m.n) {
                giveCoins(m.r); showToast(`✅ Mission done: ${m.t} (+${m.r} coins)`); floatAt(null, `+${m.r} Coins`, '#ffd600'); SFX.buy();
                do { a.i = (a.i + 1) % POOL.length; } while (S.act.some(o => o !== a && o.i === a.i));
                a.from = S[POOL[a.i].k] || 0;
            }
        });
        checkAch(); save(); renderPanel();
    }
    function checkAch() {
        ACH.forEach(([id, name, ok]) => {
            if (!S.ach[id] && ok()) { S.ach[id] = 1; showToast('🏆 Achievement: ' + name); bigBanner('🏆 ' + name); SFX.harvest(); save(); renderPanel(); }
        });
    }
    function gainXP(x) {
        S.xp += x;
        while (S.xp >= 30 * S.level) {
            S.xp -= 30 * S.level; S.level++;
            const bonus = 25 * S.level; bigBanner(`⭐ Level ${S.level}!`); SFX.harvest(); giveCoins(bonus); floatAt(null, `+${bonus} Coins`, '#ffd600', 300);
        }
        renderXP();
    }
    function renderXP() {
        let box = $('xp-box');
        if (!box) {
            box = document.createElement('div'); box.id = 'xp-box';
            const host = document.querySelector('header .flex.items-center.gap-3') || document.body;
            if (host === document.body) box.style.cssText = 'position:fixed;top:10px;right:10px;z-index:20';
            host.insertBefore(box, host.firstChild);
        }
        box.innerHTML = `<span class="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">LEVEL ${S.level}</span><div class="bar"><i style="width:${S.xp / (30 * S.level) * 100}%"></i></div>`;
    }
    // Missions + achievements live in the LEFT panel, between resources and controls.
    function renderPanel() {
        let p = $('v3-panel');
        if (!p) {
            p = document.createElement('div'); p.id = 'v3-panel';
            p.style.cssText = 'border-top:1px solid rgba(109,88,176,.3);padding-top:12px';
            const host = $('resources-section');
            if (host) host.insertBefore(p, host.querySelector('.border-t')); else document.body.appendChild(p);
        }
        p.innerHTML = `<h3 class="font-bold text-emerald-400 mb-2 text-sm">🎯 Missions</h3>` +
            S.act.map(a => { const m = POOL[a.i], v = Math.max(0, Math.min(m.n, (S[m.k] || 0) - a.from));
                return `<div class="mission"><div class="flex justify-between"><span>${m.t}</span><span>${v}/${m.n} · +${m.r}c</span></div><div class="mb"><i style="width:${v / m.n * 100}%"></i></div></div>`; }).join('') +
            `<h3 class="font-bold text-emerald-400 mt-3 mb-1 text-sm">🏆 Achievements (${Object.keys(S.ach).length}/${ACH.length})</h3><div class="ach-wrap">` +
            ACH.map(([id, name]) => `<span class="ach ${S.ach[id] ? 'on' : ''}">${name}</span>`).join('') + `</div>`;
    }

    // buying an upgrade counts towards missions
    const _buy = window.buyUpgrade;
    window.buyUpgrade = function (kind) {
        const before = owned.sprinkler + owned.solar;
        _buy(kind);
        if (owned.sprinkler + owned.solar > before) evt('buy');
    };

    // ---- pyCall wrapper #2: feeds missions / XP / achievements ----
    const _pc = window.pyCall;
    window.pyCall = function (func, ...args) {
        const wasPest = func === 'handle_tile_click' && pests.has(args[0]);
        let b = null; try { if (pyodideInstance) b = py(); } catch (e) { }
        _pc(func, ...args);
        if (wasPest) return evt('bug');
        let a = null; try { if (pyodideInstance) a = py(); } catch (e) { }
        if (!a || !b) return;
        lastCoins = a[0];
        if (func === 'handle_tile_click') { if (a[0] > b[0]) evt('harvest'); else if (a[2] > b[2]) evt('plant'); else if (a[1] < b[1]) evt('water'); }
        else if (func === 'water_all') { const n = Math.round((b[1] - a[1]) / 10); if (n > 0) evt('water', n); }
        else if (func === 'advance_day') { evt('days'); skyUpdate(); }
        checkAch();
    };

    // ============ DAY / NIGHT SKY, CLOUDS, BUTTERFLIES, MUTE ============
    let tint, orb, stars;
    function skyUpdate() {
        if (!tint) return;
        const ph = (+$('day-counter').textContent) % 4;
        const T = { 1: ['rgba(255,170,100,.16)', '🌅'], 2: ['rgba(0,0,0,0)', '☀️'], 3: ['rgba(255,90,150,.18)', '🌇'], 0: ['rgba(8,6,60,.5)', '🌙'] }[ph];
        tint.style.background = T[0]; orb.textContent = T[1]; stars.style.opacity = ph === 0 ? 1 : 0;
    }
    window.addEventListener('DOMContentLoaded', () => {
        const vg = $('view-game');
        vg.insertAdjacentHTML('afterbegin', `<div id="sky-tint"></div><div id="stars"></div><div id="sky-orb">🌅</div>` +
            [0, 1, 2].map(i => `<span class="cloud" style="animation-duration:${50 + i * 20}s;animation-delay:${-i * 25}s;top:${4 + i * 5}%">☁️</span>`).join('') +
            [0, 1, 2].map(i => `<span class="bfly" style="left:${15 + i * 25}%;top:${30 + i * 15}%;animation-delay:${-i * 4}s">🦋</span>`).join(''));
        tint = $('sky-tint'); orb = $('sky-orb'); stars = $('stars');
        const m = document.createElement('button'); m.id = 'mute-btn'; m.textContent = '🔊';
        let muted = false; const _tone = window.tone;
        window.tone = (...a) => { if (!muted) _tone(...a); };
        m.onclick = () => { muted = !muted; m.textContent = muted ? '🔇' : '🔊'; };
        document.body.appendChild(m);
        renderXP(); renderPanel();
    });
})();

// =====================================================================
// PART 5: START-UP (runs once the page has loaded)
// =====================================================================
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('version-badge').textContent = `v${APP_VERSION}`;
    lucide.createIcons();          // turn <i data-lucide> tags into icons
    populateTopicDropdown();       // fill the code editor's topic list
    refreshTopicUI();              // draw the topic status chips
    document.getElementById('tab-game').parentElement.classList.add('tabbar-fix');

    // weather overlay layer
    const fx = document.createElement('div');
    fx.id = 'weather-fx';
    document.getElementById('view-game').appendChild(fx);

    // automation shop panel
    const shop = document.createElement('div');
    shop.innerHTML = `<h3 class="text-xs font-bold text-yellow-300 uppercase tracking-wider mb-2">Automation Shop</h3>
        <div class="grid gap-2">
            <button class="shop-btn" onclick="buyUpgrade('sprinkler')"><span>💦 Sprinkler (auto-water 4)</span><span id="shop-sprinkler"></span></button>
            <button class="shop-btn" onclick="buyUpgrade('solar')"><span>☀️ Solar Panel (+10 Wh/day)</span><span id="shop-solar"></span></button>
        </div>`;
    const controls = document.querySelector('#resources-section .border-t');
    controls.parentNode.insertBefore(shop, controls);
    updateShop();

    // random pest events every 20 seconds
    setInterval(() => {
        if (pyodideInstance && typeof pyodideInstance.runPython === 'function' && Math.random() < .4) {
            try { spawnPest(); syncFromBST(); } catch (e) { /* engine not ready yet */ }
        }
    }, 20000);

    // ---- Automatic next day every 10 seconds ----
    const AUTO_SECONDS = 10;
    let autoDay = true, dayLeft = AUTO_SECONDS, lastSeenDay = document.getElementById('day-counter').textContent;
    const ad = document.createElement('div');
    ad.className = 'mb-2';
    ad.innerHTML = `<div class="flex items-center justify-between text-xs font-semibold text-amber-200 mb-1">
            <span id="auto-day-text">Next day in ${AUTO_SECONDS}s</span>
            <button id="auto-day-toggle" class="px-2 py-0.5 rounded-lg border border-amber-500/50 bg-amber-900/50 text-[10px] font-bold">Auto: ON</button></div>
        <div class="w-full h-1.5 rounded-full bg-[#1a1236] overflow-hidden"><i id="auto-day-bar" class="block h-full bg-amber-400" style="width:100%"></i></div>`;
    controls.querySelector('.grid').before(ad);
    const adText = document.getElementById('auto-day-text'), adBar = document.getElementById('auto-day-bar'), adBtn = document.getElementById('auto-day-toggle');
    const adShow = () => {
        adText.textContent = autoDay ? `Next day in ${dayLeft}s` : 'Auto day paused';
        adBar.style.width = autoDay ? (dayLeft / AUTO_SECONDS * 100) + '%' : '0%';
        adBtn.textContent = autoDay ? 'Auto: ON' : 'Auto: OFF';
    };
    adBtn.onclick = () => { autoDay = !autoDay; dayLeft = AUTO_SECONDS; adShow(); };
    setInterval(() => {
        const d = document.getElementById('day-counter').textContent;
        if (d !== lastSeenDay) { lastSeenDay = d; dayLeft = AUTO_SECONDS; }   // pressing Advance Day resets the clock
        if (!autoDay || !pyodideInstance || document.querySelector('.intro') || document.hidden) { adShow(); return; }
        dayLeft--;
        if (dayLeft <= 0) { dayLeft = AUTO_SECONDS; pyCall('advance_day'); }
        adShow();
    }, 1000);

    initPyodideEngine();           // start loading Python (takes a few seconds)
});

# Riftbound AI

An experimental artificial intelligence project focused on creating a world-class autonomous player for the trading card game **Riftbound** through deterministic game simulation, evolutionary neural networks, self-play, Swiss tournaments, and generational population management.

---

# Project Goal

The objective of this project is to create an AI capable of learning and mastering Riftbound through simulation and evolutionary competition, without hardcoded strategies or handcrafted gameplay heuristics.

The long-term vision is to develop a system capable of reaching superhuman strategic performance through:

* Deterministic game simulation
* Legal action generation
* Neural action evaluation
* Evolutionary reproduction
* Multi-parent genetic crossover
* Controlled mutation
* Swiss-style tournaments
* Generational ranking
* Long-term population purging
* Strategic adaptation through self-play

---

# Core Philosophy

This project follows a strict separation between the deterministic game engine and the neural decision system.

---

# 1. Deterministic Game Engine

The deterministic simulator is the source of truth for the game.

It is responsible for:

* Enforcing all Riftbound rules
* Validating legal actions
* Simulating complete matches
* Resolving combat and card effects
* Managing hidden information
* Managing public information
* Managing private information
* Generating every valid action available to the active player
* Guaranteeing reproducibility from the same initial seed/state

The neural network never directly manipulates the game state.

Instead, the flow is:

```txt
Game State
    ↓
Legal Action Generator
    ↓
Neural Network Evaluation
    ↓
Selected Action
    ↓
Simulator Applies Action
```

The AI does not need to know which actions are legal. All illegal actions must be filtered before the neural network evaluates anything.

---

# 2. Neural Decision System

The neural decision system is responsible only for:

* Encoding cards
* Encoding actions
* Encoding game states
* Evaluating legal actions
* Assigning a score from `0.0` to `1.0` to each legal action
* Selecting actions probabilistically
* Competing against other neural networks
* Reproducing through genetic crossover and mutation

The neural network does not output a fixed global move ID.

Instead, the simulator provides the current legal actions, and the network evaluates each one.

---

# Decision Model

At each decision point:

```txt
Current Game State
    ↓
Legal Actions
    ↓
Encode State
    ↓
Encode Each Action
    ↓
Evaluate Action Scores
    ↓
Probabilistic Selection
```

Each possible action receives a value between:

```txt
0.0 → 1.0
```

Example:

```txt
Action A = 0.1
Action B = 0.8
Action C = 0.0
```

The selected action is chosen through weighted randomization.

Example:

```txt
total = 0.9
randomValue = random(0.0, 0.9)

0.0 - 0.1 → Action A
0.1 - 0.9 → Action B
```

This allows better actions to be selected more often while still preserving exploration.

---

# Neural Architecture Overview

```txt
Game Simulator
    ↓
Legal Actions
    ↓
State Encoders
    ↓
Action Encoders
    ↓
Neural Evaluation Network
    ↓
Action Scores
    ↓
Probabilistic Selection
    ↓
Game Simulator
```

---

# Input Representation

The neural network receives the game state as a collection of encoded zones and encoded actions.

Planned high-level input zones:

* Player hand
* Opponent hand information
* Player graveyard / discard pile
* Opponent graveyard / discard pile
* Player battlefield
* Opponent battlefield
* Baron battlefield
* Player base
* Opponent base
* Player game state
* Opponent game state
* Possible actions
* Player deck
* Opponent deck information

Hidden information must not be directly exposed to the neural network unless it is information that the player could legally know.

For unknown information, the system should represent probabilities, known card counts, revealed cards, public history, or belief-state estimations.

---

# Core Encoders

The project is based on a modular encoder system.

Main planned encoders:

* `CardEncoder`
* `ActionEncoder`
* `GameStateEncoder`
* `TargetEncoder`
* `ZoneEncoder`
* `DeckEncoder`
* `BattlefieldEncoder`
* `BaseEncoder`

Encoders transform structured game objects into numeric vectors that can be consumed by neural networks.

---

# Card Encoder

The `CardEncoder` transforms a card and its current contextual state into a numeric vector.

## Input

```ts
type CardEncoderInput = {
  energyCost: number;
  powerCost: number;
  type: 'unit' | 'gear' | 'spell';
  keywordEncoderVector: number[];
  tagEncoderVector: number[];
  effectEncoderVector: number[];
  stateEncoderVector: number[];
  attentionVector: number[];
};
```

## Output

```ts
type CardEncoderOutput = number[];
```

The output vector contains values normalized between:

```txt
0.0 → 1.0
```

## Field Definitions

### `energyCost`

The energy cost of the card.

This value should be normalized before entering the neural network.

Example:

```txt
normalizedEnergyCost = energyCost / maxPossibleEnergyCost
```

---

### `powerCost`

The power cost of the card.

This value should also be normalized.

---

### `type`

The card type.

Supported initial values:

```ts
'type' = 'unit' | 'gear' | 'spell'
```

Internally this should be converted into a vector representation, for example one-hot encoding:

```txt
unit  → [1, 0, 0]
gear  → [0, 1, 0]
spell → [0, 0, 1]
```

---

### `keywordEncoderVector`

A vector containing every Riftbound keyword.

Each position represents one keyword.

```txt
1.0 → card has this keyword
0.0 → card does not have this keyword
```

Example:

```txt
[QuickDraw, Scout, Hidden, ...]
[1.0,       0.0,   0.0,    ...]
```

This vector must be versioned according to the available card database and ruleset.

---

### `tagEncoderVector`

A vector containing every known Riftbound tag.

Each position represents one tag.

```txt
1.0 → card has this tag
0.0 → card does not have this tag
```

Example:

```txt
[Yordle, Demacia, SpellDamage, ...]
[0.0,    1.0,     0.0,         ...]
```

This vector must be versioned according to the card database.

---

### `effectEncoderVector`

A vector representation generated from the card text.

This vector should be based entirely on what is written on the card.

The initial goal is to encode the card effect text into a numeric representation without manually hardcoding strategy.

Possible future approaches:

* Rule-based text parser
* Keyword/action extraction
* Domain-specific effect grammar
* Text embedding model
* Hybrid symbolic/neural effect encoding

Important principle:

```txt
The effect encoder represents what the card says, not how good the card is.
```

Strategic value should be learned through gameplay.

---

### `stateEncoderVector`

A contextual vector representing the current state of this specific card instance.

Examples of possible information:

* Current zone
* Whether the card is in hand
* Whether the card is in deck
* Whether the card is in graveyard
* Whether the card is in play
* Whether the card is in the chain/stack
* Whether the card is exhausted/tapped
* Whether the card can currently act
* Whether the card is revealed
* Whether the card is known by the player
* Probability that the player knows this card
* Current damage on the card
* Current temporary modifiers
* Current attached gear/effects
* Current legal targets
* Current restrictions
* Current battlefield location

This vector is not static card information.

It represents the current state of a card instance inside a match.

---

### `attentionVector`

A vector that maps generally relevant information about cards.

This vector is intended to help the network understand which card attributes may deserve contextual focus.

Potential examples:

* Offensive relevance
* Defensive relevance
* Resource relevance
* Combo relevance
* Tempo relevance
* Removal relevance
* Board presence relevance
* Lethal potential relevance
* Protection relevance
* Draw/value relevance
* Synergy relevance

This vector may initially be simple or randomly initialized, but future versions may learn or evolve it.

---

# Action Encoder

The `ActionEncoder` transforms a possible legal action into a numeric vector.

The simulator is responsible for generating only legal actions.

The neural network receives each legal action and evaluates its quality in the current game state.

## Input

```ts
type ActionEncoderInput = {
  type: 'play' | 'pass' | 'move' | 'target' | 'tap';
  cardVector: CardEncoderOutput;
  targetVector: TargetEncoderOutput;
  costsVector: number[];
  expectedInteractionsVector: number[];
  gameStateVector: GameStateEncoderOutput;
};
```

## Output

```ts
type ActionEncoderOutput = number[];
```

The output vector contains values normalized between:

```txt
0.0 → 1.0
```

## Field Definitions

### `type`

The action type.

Initial supported action types:

```ts
'play' | 'pass' | 'move' | 'target' | 'tap'
```

Internally, this should be converted to a numeric representation.

Example:

```txt
play   → [1, 0, 0, 0, 0]
pass   → [0, 1, 0, 0, 0]
move   → [0, 0, 1, 0, 0]
target → [0, 0, 0, 1, 0]
tap    → [0, 0, 0, 0, 1]
```

---

### `cardVector`

The encoded representation of the card related to the action.

Examples:

* Card being played
* Card being tapped
* Card being moved
* Card generating an effect
* Card selected as part of a target decision

For actions that do not involve a card, this field should use a neutral empty-card vector.

---

### `targetVector`

The encoded representation of the target of the action.

Targets may include:

* Unit
* Gear
* Spell
* Battlefield
* Base
* Player
* Champion
* Empty target
* Multiple targets

The `TargetEncoder` should normalize these possibilities into a fixed numeric representation.

---

### `costsVector`

A vector representing all costs required to execute the action.

Examples:

* Energy cost
* Power cost
* Tap/exhaust cost
* Discard cost
* Sacrifice cost
* Opportunity cost
* Required battlefield movement
* Required target conditions

All values should be normalized between `0.0` and `1.0` when possible.

---

### `expectedInteractionsVector`

A vector representing possible interactions or immediate consequences associated with the action.

Examples:

* Damage expected
* Healing expected
* Draw expected
* Cards discarded
* Board change
* Battlefield pressure
* Target removal potential
* Resource generation
* Combat implications
* Chain/stack implications
* Possible response windows

This does not need to be perfectly strategic at the beginning.

It can start as a simple structural representation and evolve later.

---

### `gameStateVector`

The encoded representation of the current game state.

This allows the same action to receive different meanings depending on context.

Example:

```txt
Playing a damage spell while the opponent is near defeat is different from playing the same damage spell on turn one.
```

---

# GameState Encoder

The `GameStateEncoder` transforms the current match state into a strategic vector.

Possible inputs:

* Turn number
* Current phase
* Active player
* Priority player
* Player score
* Opponent score
* Player resources
* Opponent resources
* Player hand encoding
* Opponent hand information encoding
* Player battlefield encoding
* Opponent battlefield encoding
* Baron battlefield encoding
* Player base encoding
* Opponent base encoding
* Player graveyard encoding
* Opponent graveyard encoding
* Player deck encoding
* Opponent deck belief encoding
* Public action history
* Known hidden information
* Probability estimates

Output:

```ts
type GameStateEncoderOutput = number[];
```

---

# Zone Encoders

A zone encoder transforms a variable-sized collection of objects into a fixed-size vector.

Examples of zones:

* Hand
* Deck
* Graveyard
* Battlefield
* Base
* Chain/stack
* Exile/removed area

Initial zone encoding may use:

* Mean pooling
* Sum pooling
* Max pooling
* Zone counters
* Normalized quantities

Future zone encoding may use:

* Self-attention
* Transformer blocks
* Cross-zone attention
* Learned pooling

---

# Hidden Information

The system must respect hidden information.

The AI should not receive direct access to unknown opponent cards.

Opponent hand and deck information should be represented through:

* Hand size
* Known revealed cards
* Cards previously played
* Public deck information
* Champion/archetype information
* Probability distribution over possible cards
* Belief-state estimates

The simulator may know the full game state internally, but the neural network input must be generated from the perspective of the player making the decision.

---

# Attention System

Attention is planned as an important future component.

The purpose of attention is to help the network determine which cards, actions, targets, or zones are most relevant in the current context.

Possible applications:

* Card-to-card synergy
* Hand-to-board relevance
* Action-to-target relevance
* Threat detection
* Combo detection
* Lethal detection
* Defensive priority
* Resource efficiency
* Battlefield priority
* Hidden information inference

Initial versions may use simple attention vectors.

Future versions may introduce:

* Self-attention inside zones
* Cross-attention between hand and battlefield
* Cross-attention between action and game state
* Transformer-based state encoders

---

# Evolutionary Training System

This project uses evolutionary neural networks rather than traditional Q-learning.

The population consists of neural players.

Each neural player is represented by:

* Neural matrices
* Encoder parameters
* Action evaluation parameters
* Mutation history
* Genealogy metadata
* Generation ID
* Tournament performance history

---

# Tournament Format

Training is organized through Swiss-style tournaments.

Each generation contains a population of neural players.

Players compete in Swiss tournaments where each player plays a fixed number of rounds.

Example:

```txt
Population: 1000 players
Tournament format: Swiss
Rounds per player: X
```

The number of rounds per player also affects reproduction structure.

---

# Reproductive System

Evolution is not based only on cloning the best players.

Instead, each victory grants the right to produce one child.

```txt
1 victory = 1 child slot
```

Each child is generated from multiple parents.

The number of parents for each child is equal to the number of matches played by each player in the tournament.

```txt
parentsPerChild = matchesPerPlayer
```

Example:

```txt
If each player plays 3 matches:
Each child has 3 parents.
```

The child is created by combining the neural matrices of its parents.

A light mutation is always applied.

```txt
Child = crossover(parentA, parentB, parentC, ...) + lightMutation
```

---

# Genetic Crossover

Genetic crossover combines neural matrices from multiple parents.

Possible crossover strategies:

* Random weight selection
* Layer-level inheritance
* Matrix block inheritance
* Weighted average of parent matrices
* Performance-weighted inheritance
* Genealogical diversity-aware inheritance

Initial implementation may start with simple random matrix selection or weighted averaging.

Future versions may evolve more advanced crossover strategies.

---

# Mutation System

Every child receives a light mutation.

Mutations may affect:

* Neural weights
* Biases
* Encoder matrices
* Attention vectors
* Decision temperature
* Action score scaling
* Exploration behavior
* Layer-specific parameters

Mutation should be strong enough to introduce variation but weak enough to preserve useful inherited structures.

---

# Generations

Each tournament produces a new generation.

Generations must be saved for future evaluation.

Saved generation data should include:

* Player IDs
* Neural parameters
* Parent IDs
* Child IDs
* Match results
* Win/loss records
* Tournament ranking
* Mutation metadata
* Generation seed
* Simulator version
* Card database version
* Ruleset version

This allows the project to reproduce, analyze, and compare historical players.

---

# Super Tournament

After `Y` generations, a super tournament is created.

The super tournament includes players from multiple or all previous generations.

Goal:

```txt
Rank players across generations and identify the strongest historical neural players.
```

The super tournament also uses a Swiss format.

However, the number of rounds is calculated differently.

The super tournament should use the smallest possible number of Swiss rounds required for only one player to remain undefeated.

Conceptually:

```txt
Minimum rounds such that only one player can finish with 100% win rate.
```

For a population of `N` players, this is approximately:

```txt
ceil(log2(N)) rounds
```

assuming no draws and normal Swiss pairing behavior.

---

# Purge System

After a super tournament, a purge process is executed.

The super tournament produces a full ranking of players:

```txt
Rank 1 → Best player
Rank 2
Rank 3
...
Rank N → Last player
```

The purge system selects the best-ranked players while removing excessive genetic redundancy from the population.

The goal is to preserve the strongest players without allowing the population to become dominated by many close relatives of the same successful lineage.

---

# Purge Algorithm

Each player has a `purgeAccumulator`.

Initial value:

```txt
purgeAccumulator = 0.0
```

After the super tournament ranking is generated, the purge process runs in ticks.

At each tick:

1. Select the highest-ranked player that has not been purged.
2. Mark this player as saved.
3. This player remains available for future simulations.
4. Traverse this player's genealogy tree.
5. Add genetic match values to related players' `purgeAccumulator`.
6. Any player whose `purgeAccumulator` becomes greater than `1.0` is purged.

Saved players are protected and must not be removed by the purge process.

---

# Genetic Match Accumulation

When a player is selected and saved, relatives receive purge accumulation based on their genetic match percentage with the selected player.

The accumulation value is always equal to the percentage of genetic match between the selected player and the related player.

Example:

```txt
Selected player: Player A
Parents per child: 3
```

Each direct child of Player A receives:

```txt
1 / 3 = 0.333333...
```

Each grandchild receives:

```txt
1 / 9 = 0.111111...
```

Each great-grandchild receives:

```txt
1 / 27 = 0.037037...
```

The same logic applies upward in the genealogy tree.

Each parent receives:

```txt
1 / 3 = 0.333333...
```

Each grandparent receives:

```txt
1 / 9 = 0.111111...
```

Each great-grandparent receives:

```txt
1 / 27 = 0.037037...
```

And so on.

---

# Multiple Genealogical Paths

If a player is related to the selected player through multiple genealogical paths, each path contributes separately to the `purgeAccumulator`.

Example:

```txt
A player is a grandchild of Player A through two different parent paths.
```

Then this player receives:

```txt
1/9 + 1/9
```

The purge accumulator must represent the total genetic match percentage with the selected player across all known genealogical paths.

---

# Purge Elimination Rule

A player is eliminated when:

```txt
purgeAccumulator > 1.0
```

A purged player is removed from future simulations and may be deleted from the active population storage.

The player may still remain in historical records if needed for genealogy, auditability, or reproducibility.

---

# Purge Purpose

This encourages:

* Genetic diversity
* Strategic diversity
* Less overfitting to local evolutionary branches
* Better long-term exploration
* Reduced population collapse
* Protection of elite players
* Controlled removal of redundant relatives

The purge system should preserve strong historical performers while preventing closely related descendants, ancestors, or sibling branches from overcrowding future generations.

---

# Development Methodology

The entire project is intended to be developed using Test Driven Development.

The project may be developed with the support of AI coding agents.

---

# Golden Rule for TDD with AI Agents

Mock files are protected development artifacts.

AI agents must never edit existing mock files.

The maximum an AI agent may do is:

* Create a new mock file from scratch
* Request that the human developer adds or updates specific mocks

AI agents are not allowed to directly modify pre-existing mock files.

This rule exists to preserve test reliability and prevent agents from making the tests pass by changing controlled test fixtures instead of correctly implementing production logic.

---

## TDD Requirements

Every critical system must be validated through automated tests.

Important test areas:

* Game rules
* Game state transitions
* Legal action generation
* Hidden information filtering
* Card encoding
* Action encoding
* Game state encoding
* Action scoring
* Probabilistic action selection
* Tournament pairing
* Swiss tournament ranking
* Reproduction rights
* Multi-parent crossover
* Mutation logic
* Generation persistence
* Super tournament logic
* Purge logic
* Genealogical purge accumulation
* Genetic match calculation across multiple genealogy paths
* Protection of saved players during purge
* Reproducibility by seed
* Protection of existing mock files from AI-agent edits

---

# Planned Repository Structure

```txt
/src
    /engine
        /rules
        /state
        /actions
        /effects
        /simulation

    /encoders
        /card
        /action
        /target
        /zone
        /game-state
        /deck
        /battlefield
        /base

    /neural
        /matrix
        /network
        /evaluation
        /attention

    /evolution
        /population
        /generation
        /crossover
        /mutation
        /genealogy
        /purge

    /tournament
        /swiss
        /matchmaking
        /ranking
        /super-tournament

    /training
        /self-play
        /orchestration
        /statistics
        /replay

    /persistence
        /players
        /generations
        /matches
        /snapshots

    /tests
```

---

# Current Status

Planned systems:

* [ ] Deterministic simulator
* [ ] Legal action generator
* [ ] Player-perspective state generator
* [ ] Card encoder
* [ ] Action encoder
* [ ] Target encoder
* [ ] Game state encoder
* [ ] Zone encoders
* [ ] Neural action evaluator
* [ ] Probabilistic action selector
* [ ] Swiss tournament system
* [ ] Population manager
* [ ] Multi-parent reproduction system
* [ ] Crossover engine
* [ ] Mutation engine
* [ ] Generation persistence
* [ ] Super tournament system
* [ ] Genealogy-based purge system
* [ ] Replay and statistics system

---

# Research Inspiration

This project draws inspiration from:

* Neuroevolution
* Population-based training
* Self-play systems
* AlphaZero-style action evaluation
* OpenAI Five-style competitive learning
* Imperfect information game theory
* Trading card game AI research
* Genetic algorithms
* Swiss tournament ranking systems

---

# Final Vision

The ultimate goal is to create an AI capable of:

* Learning Riftbound from simulated gameplay
* Discovering strategies autonomously
* Adapting to evolving metas
* Preserving strategic diversity
* Improving through evolutionary pressure
* Learning from generations of competition
* Playing at a superhuman level
* Becoming one of the strongest Riftbound players in the world

// -----------------------------
    // Rank system (tier-based only)
    // -----------------------------
    const RANKS = [
      "Bronze 1", "Bronze 2", "Bronze 3",
      "Silver 1", "Silver 2", "Silver 3",
      "Gold 1", "Gold 2", "Gold 3",
      "Platinum 1", "Platinum 2", "Platinum 3",
      "Diamond 1", "Diamond 2", "Diamond 3",
      "Champion 1", "Champion 2", "Champion 3",
      "Grand Champion 1", "Grand Champion 2", "Grand Champion 3",
      "Supersonic Legend"
    ];

    const RANK_INDEX = Object.fromEntries(RANKS.map((rank, index) => [rank, index]));

    // --------------------------------------------------------
    // Progressive prices between consecutive rank transitions.
    // transitionPrices[0] means Bronze 1 -> Bronze 2, etc.
    //
    // Required totals:
    // Bronze 1 -> SSL = exactly $100
    // GC1 -> SSL = exactly $40
    // --------------------------------------------------------
    const TRANSITION_PRICES = [
      1, 1, 1.5, 1.5, 2, 2, 2.5, 2.5, 3, 3, 3.5, 3.5, 4, 4.5, 5, 5.5, 6, 8, 12, 13, 15
    ];

    // --------------------------------------------------------
    // Playlist caps by mode.
    // Tournament is handled separately.
    // --------------------------------------------------------
    const MODE_CAPS = {
      "1v1": "Grand Champion 2",
      "2v2": "Supersonic Legend",
      "3v3": "Supersonic Legend",
      "4v4": "Grand Champion 2",
      "heatseeker": "Champion 1",
      "rumble": "Grand Champion 2",
      "snowday": "Supersonic Legend"
    };

    // Modes that cost 25% extra.
    const MODE_MULTIPLIERS = {
      "1v1": 1.25,
      "4v4": 1.25,
      "heatseeker": 1.25,
      "rumble": 1.25
    };

    // --------------------------------------------------------
    // Tournament pricing ladder.
    // User asked for tournament wins all the way from Bronze up.
    // GC, SSL, and 3x SSL preserve the requested prices.
    // --------------------------------------------------------
    const TOURNAMENT_OPTIONS = [
      { key: "bronze-win", label: "Bronze tournament win", price: 6, days: 1, sort: 1 },
      { key: "silver-win", label: "Silver tournament win", price: 8, days: 1, sort: 2 },
      { key: "gold-win", label: "Gold tournament win", price: 10, days: 1, sort: 3 },
      { key: "platinum-win", label: "Platinum tournament win", price: 13, days: 1, sort: 4 },
      { key: "diamond-win", label: "Diamond tournament win", price: 16, days: 2, sort: 5 },
      { key: "champion-win", label: "Champion tournament win", price: 18, days: 2, sort: 6 },
      { key: "gc-win", label: "GC tournament win", price: 20, days: 2, sort: 7 },
      { key: "ssl-win", label: "SSL tournament win", price: 30, days: 2, sort: 8 },
      { key: "ssl-3x", label: "3x SSL tournament wins", price: 75, days: 5, sort: 9 }
    ];

    const TOURNAMENT_MAP = Object.fromEntries(TOURNAMENT_OPTIONS.map(item => [item.key, item]));

    // --------------------------------------------------------
    // SSL MMR pricing.
    // Easy to edit later:
    // subtotal = baseFee + (mmrGain * perPoint)
    // days = ceil(mmrGain / pointsPerDay)
    // --------------------------------------------------------
    const MMR_CONFIG = {
      standard: { minCurrent: 1875, maxDesired: 2200, baseFee: 8, perPoint: 0.16, pointsPerDay: 100 },
      snowday: { minCurrent: 1275, maxDesired: 1400, baseFee: 6, perPoint: 0.22, pointsPerDay: 60 }
    };

    // GC rewards should always match the GC1 -> GC2 transition price.
    // SSL rewards are a flat extra.
    const SSL_REWARDS_EXTRA = 15;

    const elements = {
      mode: document.getElementById("mode"),
      boostType: document.getElementById("boostType"),
      boostButtons: document.querySelectorAll(".boost-toggle"),
      regionWrap: document.getElementById("regionWrap"),
      region: document.getElementById("region"),
      regionHint: document.getElementById("regionHint"),
      tournamentOptionWrap: document.getElementById("tournamentOptionWrap"),
      tournamentOption: document.getElementById("tournamentOption"),
      currentRankWrap: document.getElementById("currentRankWrap"),
      currentRank: document.getElementById("currentRank"),
      desiredRankWrap: document.getElementById("desiredRankWrap"),
      desiredRank: document.getElementById("desiredRank"),
      mmrWrap: document.getElementById("mmrWrap"),
      currentMmr: document.getElementById("currentMmr"),
      desiredMmr: document.getElementById("desiredMmr"),
      mmrHint: document.getElementById("mmrHint"),
      rewardWrap: document.getElementById("rewardWrap"),
      rewardToggle: document.getElementById("rewardToggle"),
      rewardTitle: document.getElementById("rewardTitle"),
      rewardSubtext: document.getElementById("rewardSubtext"),
      summaryContent: document.getElementById("summaryContent"),
      priceValue: document.getElementById("priceValue"),
      deliveryValue: document.getElementById("deliveryValue"),
      validationMessage: document.getElementById("validationMessage"),
      placeOrderBtn: document.getElementById("placeOrderBtn"),
      orderModal: document.getElementById("orderModal"),
      modalSummary: document.getElementById("modalSummary"),
      closeModalBtn: document.getElementById("closeModalBtn")
    };

    const customSelectRegistry = new Map();
    let rewardsEnabled = false;

    const money = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    function getBoostType() {
      return elements.boostType.value;
    }

    function isTournamentMode() {
      return elements.mode.value === "tournament";
    }

    function capRankForMode(mode) {
      return MODE_CAPS[mode];
    }

    function getAllowedRanks(mode) {
      if (mode === "tournament") return [];
      const capIndex = RANK_INDEX[capRankForMode(mode)];
      return RANKS.slice(0, capIndex + 1);
    }

    function isSslCapableMode(mode) {
      return capRankForMode(mode) === "Supersonic Legend";
    }

    function getMmrSettings(mode) {
      return mode === "snowday" ? MMR_CONFIG.snowday : MMR_CONFIG.standard;
    }

    function formatDays(days) {
      return days === 1 ? "1 day" : `${days} days`;
    }

    function bumpValue(el) {
      el.classList.remove("bump");
      void el.offsetWidth;
      el.classList.add("bump");
      setTimeout(() => el.classList.remove("bump"), 220);
    }

    function priceBetweenRanks(currentRank, desiredRank) {
      const start = RANK_INDEX[currentRank];
      const end = RANK_INDEX[desiredRank];
      if (start == null || end == null || end <= start) return 0;

      return TRANSITION_PRICES.slice(start, end).reduce((sum, price) => sum + price, 0);
    }

    function estimateStandardDays(currentRank, desiredRank) {
      const start = RANK_INDEX[currentRank];
      const end = RANK_INDEX[desiredRank];
      const tiersCrossed = Math.max(0, end - start);

      // Delivery logic:
      // The examples provided map better to major rank bands rather than literal tiers.
      // 3 tiers = roughly 1 full rank band, so we estimate one day per band crossed.
      return Math.max(1, Math.ceil(tiersCrossed / 3));
    }

    function calculateMmrOrder(mode, currentMmr, desiredMmr) {
      const config = getMmrSettings(mode);
      const mmrGain = desiredMmr - currentMmr;

      // SSL MMR pricing:
      // subtotal = base fee + (gained MMR * per-point cost)
      const price = config.baseFee + (mmrGain * config.perPoint);

      // SSL MMR delivery:
      // days scale by the configured pointsPerDay
      const days = Math.max(1, Math.ceil(mmrGain / config.pointsPerDay));

      return { price, days };
    }

    function getGcRewardsExtra() {
      return priceBetweenRanks("Grand Champion 1", "Grand Champion 2");
    }

    function getDetectedRewardType(context) {
      if (!rewardsEnabled || context.tournamentMode) return "none";

      if (context.useMmrFlow) {
        return "ssl";
      }

      if (!context.targetRank) return "none";

      if (context.targetRank === "Supersonic Legend") return "ssl";
      if (RANK_INDEX[context.targetRank] >= RANK_INDEX["Grand Champion 1"]) return "gc";

      return "none";
    }

    function getRewardExtra(rewardType) {
      if (rewardType === "gc") return getGcRewardsExtra();
      if (rewardType === "ssl") return SSL_REWARDS_EXTRA;
      return 0;
    }

    function syncBoostButtons() {
      elements.boostButtons.forEach(button => {
        button.classList.toggle("active", button.dataset.value === getBoostType());
      });
    }

    function populateTournamentOptions() {
      elements.tournamentOption.innerHTML = TOURNAMENT_OPTIONS
        .sort((a, b) => a.sort - b.sort)
        .map(option => `<option value="${option.key}">${option.label}</option>`)
        .join("");
      refreshCustomSelect(elements.tournamentOption);
    }

    function populateRankSelects() {
      const mode = elements.mode.value;
      const allowedRanks = getAllowedRanks(mode);
      const currentBefore = elements.currentRank.value;
      const desiredBefore = elements.desiredRank.value;

      elements.currentRank.innerHTML = allowedRanks
        .map(rank => `<option value="${rank}">${rank}</option>`)
        .join("");

      if (allowedRanks.includes(currentBefore)) {
        elements.currentRank.value = currentBefore;
      } else if (allowedRanks.includes("Diamond 2")) {
        elements.currentRank.value = "Diamond 2";
      } else {
        elements.currentRank.selectedIndex = 0;
      }

      refreshCustomSelect(elements.currentRank);
      syncDesiredRankOptions(desiredBefore);
    }

    function syncDesiredRankOptions(previousDesiredValue = "") {
      const mode = elements.mode.value;
      const allowedRanks = getAllowedRanks(mode);
      const currentRank = elements.currentRank.value;
      const currentIndex = RANK_INDEX[currentRank];
      const desiredRanks = allowedRanks.filter(rank => RANK_INDEX[rank] > currentIndex);

      if (!desiredRanks.length) {
        elements.desiredRank.innerHTML = `<option value="">No higher rank available</option>`;
      } else {
        elements.desiredRank.innerHTML = desiredRanks.map(rank => `<option value="${rank}">${rank}</option>`).join("");
      }

      if (desiredRanks.includes(previousDesiredValue)) {
        elements.desiredRank.value = previousDesiredValue;
      } else if (desiredRanks.includes("Champion 1")) {
        elements.desiredRank.value = "Champion 1";
      } else if (desiredRanks.length) {
        elements.desiredRank.selectedIndex = 0;
      }

      refreshCustomSelect(elements.desiredRank);
    }

    function getTargetContext() {
      const tournamentMode = isTournamentMode();
      const currentRank = elements.currentRank.value;
      const useMmrFlow = !tournamentMode && isSslCapableMode(elements.mode.value) && currentRank === "Supersonic Legend";
      const targetRank = tournamentMode ? null : (useMmrFlow ? "Supersonic Legend" : elements.desiredRank.value || null);

      return {
        tournamentMode,
        currentRank,
        useMmrFlow,
        targetRank
      };
    }

    function syncRewardToggleState() {
      const context = getTargetContext();
      const rewardType = getDetectedRewardType(context);
      const unavailable = context.tournamentMode || rewardType === "none";

      elements.rewardWrap.classList.toggle("hidden", context.tournamentMode);

      elements.rewardToggle.classList.toggle("active", rewardsEnabled && !unavailable);
      elements.rewardToggle.classList.toggle("disabled", unavailable);

      if (context.tournamentMode) {
        rewardsEnabled = false;
        elements.rewardTitle.textContent = "Rewards not available";
        elements.rewardSubtext.textContent = "Tournament orders do not use season rewards.";
        elements.rewardToggle.classList.remove("active");
        elements.rewardToggle.classList.add("disabled");
        return;
      }

      if (rewardType === "gc") {
        elements.rewardTitle.textContent = "Add GC Rewards";
        elements.rewardSubtext.textContent = `Adds ${money.format(getGcRewardsExtra())} automatically.`;
      } else if (rewardType === "ssl") {
        elements.rewardTitle.textContent = "Add SSL Rewards";
        elements.rewardSubtext.textContent = `Adds ${money.format(SSL_REWARDS_EXTRA)} automatically.`;
      } else {
        if (rewardsEnabled) rewardsEnabled = false;
        elements.rewardTitle.textContent = "Season Rewards Unavailable";
        elements.rewardSubtext.textContent = "Reach at least Grand Champion 1 to add rewards.";
      }

      elements.rewardToggle.classList.toggle("active", rewardsEnabled && rewardType !== "none");
    }

    function syncUiVisibility() {
      const mode = elements.mode.value;
      const boostType = getBoostType();
      const tournamentMode = isTournamentMode();
      const currentRank = elements.currentRank.value;
      const useMmrFlow = !tournamentMode && isSslCapableMode(mode) && currentRank === "Supersonic Legend";

      elements.regionWrap.classList.toggle("hidden", boostType !== "duo");
      elements.tournamentOptionWrap.classList.toggle("hidden", !tournamentMode);
      elements.currentRankWrap.classList.toggle("hidden", tournamentMode);
      elements.desiredRankWrap.classList.toggle("hidden", tournamentMode || useMmrFlow);
      elements.mmrWrap.classList.toggle("hidden", !useMmrFlow);

      if (boostType === "duo") {
        elements.regionHint.textContent = tournamentMode
          ? "Tournament duo uses +50% in NA and +100% outside NA."
          : "Standard duo uses +20% in NA and +30% outside NA.";
      }

      if (useMmrFlow) {
        const mmrConfig = getMmrSettings(mode);
        elements.currentMmr.min = mmrConfig.minCurrent;
        elements.currentMmr.max = mmrConfig.maxDesired;
        elements.desiredMmr.min = mmrConfig.minCurrent + 1;
        elements.desiredMmr.max = mmrConfig.maxDesired;
        elements.mmrHint.textContent = mode === "snowday"
          ? "Snowday SSL uses current MMR 1275+ and desired MMR up to 1400."
          : "Standard SSL modes use current MMR 1875+ and desired MMR up to 2200.";

        if (!elements.currentMmr.value || Number(elements.currentMmr.value) < mmrConfig.minCurrent) {
          elements.currentMmr.value = mmrConfig.minCurrent;
        }

        const minDesired = Number(elements.currentMmr.value) + 1;
        elements.desiredMmr.min = Math.min(mmrConfig.maxDesired, minDesired);

        if (!elements.desiredMmr.value || Number(elements.desiredMmr.value) <= Number(elements.currentMmr.value)) {
          elements.desiredMmr.value = Math.min(mmrConfig.maxDesired, Number(elements.currentMmr.value) + 25);
        }
      }

      syncRewardToggleState();
    }

    function buildPills(multiplierDetails) {
      if (!multiplierDetails.length) {
        return `<div class="pill-wrap"><span class="pill">Base pricing only</span></div>`;
      }
      return `<div class="pill-wrap">${multiplierDetails.map(item => `<span class="pill">${item}</span>`).join("")}</div>`;
    }

    function buildOrderRows(result, forModal = false) {
      const rows = [];
      const addRow = (label, value) => {
        if (value === null || value === undefined || value === "") return;
        rows.push([label, value]);
      };

      addRow("Completion Method", result.boostType === "duo" ? "Duo boost" : "Solo boost");
      addRow("Gamemode", result.mode);

      if (result.tournamentMode) {
        addRow("Tournament Order", result.tournamentLabel);
      } else {
        addRow("Current Rank", result.currentRank);
        addRow("Desired Rank", result.useMmrFlow ? "SSL MMR target" : result.desiredRank);
        if (result.useMmrFlow) {
          addRow("Current MMR", result.currentMmr);
          addRow("Desired MMR", result.desiredMmr);
        }
      }

      if (result.boostType === "duo") {
        addRow("Region", result.region);
      }

      if (!result.tournamentMode && result.rewardType !== "none") {
        addRow("Rewards", result.rewardType === "gc" ? "GC rewards" : "SSL rewards");
      }

      if (!forModal) {
        addRow("Subtotal", money.format(result.subtotal));
        if (result.rewardExtra > 0) addRow("Reward Add-on", money.format(result.rewardExtra));
        addRow("Final Total", money.format(result.finalTotal));
        addRow("Estimated Delivery", formatDays(result.deliveryDays));
      } else {
        addRow("Price", money.format(result.finalTotal));
        addRow("Estimated Delivery Time", formatDays(result.deliveryDays));
      }

      return rows;
    }

    function calculateOrder() {
      const mode = elements.mode.value;
      const boostType = getBoostType();
      const region = elements.region.value;
      const tournamentMode = isTournamentMode();

      const result = {
        valid: false,
        errors: [],
        tournamentMode,
        mode,
        boostType,
        region: boostType === "duo" ? region : null,
        multiplierLabels: [],
        subtotal: 0,
        rewardExtra: 0,
        finalTotal: 0,
        deliveryDays: 0,
        rewardType: "none",
        currentRank: null,
        desiredRank: null,
        useMmrFlow: false,
        currentMmr: null,
        desiredMmr: null,
        tournamentLabel: null
      };

      if (boostType === "duo" && !region) {
        result.errors.push("Select a region for duo boosting.");
      }

      if (tournamentMode) {
        const option = TOURNAMENT_MAP[elements.tournamentOption.value];
        if (!option) {
          result.errors.push("Select a tournament order.");
        } else {
          let tournamentMultiplier = 1;

          if (boostType === "duo") {
            tournamentMultiplier = region === "NA" ? 1.5 : 2;
            result.multiplierLabels.push(region === "NA" ? "Tournament Duo +50%" : "Tournament Duo +100%");
          }

          result.tournamentLabel = option.label;
          result.subtotal = option.price;
          result.rewardExtra = 0;
          result.finalTotal = result.subtotal * tournamentMultiplier;
          result.deliveryDays = option.days * (boostType === "duo" ? 2 : 1);
        }

        result.rewardType = "none";
        result.valid = result.errors.length === 0;
        return result;
      }

      result.currentRank = elements.currentRank.value;
      result.useMmrFlow = isSslCapableMode(mode) && result.currentRank === "Supersonic Legend";

      let basePrice = 0;
      let baseDays = 0;

      if (!result.currentRank) {
        result.errors.push("Select a current rank.");
      }

      if (result.useMmrFlow) {
        const mmrConfig = getMmrSettings(mode);
        result.currentMmr = Number(elements.currentMmr.value);
        result.desiredMmr = Number(elements.desiredMmr.value);
        result.desiredRank = "Supersonic Legend";

        if (!Number.isFinite(result.currentMmr) || !Number.isFinite(result.desiredMmr)) {
          result.errors.push("Enter both current and desired MMR values.");
        } else {
          if (result.currentMmr < mmrConfig.minCurrent) {
            result.errors.push(`Current MMR must be at least ${mmrConfig.minCurrent} for ${mode}.`);
          }
          if (result.desiredMmr > mmrConfig.maxDesired) {
            result.errors.push(`Desired MMR cannot exceed ${mmrConfig.maxDesired} for ${mode}.`);
          }
          if (result.desiredMmr <= result.currentMmr) {
            result.errors.push("Desired MMR must be higher than current MMR.");
          }
        }

        if (!result.errors.length) {
          const mmrOrder = calculateMmrOrder(mode, result.currentMmr, result.desiredMmr);
          basePrice = mmrOrder.price;
          baseDays = mmrOrder.days;
        }
      } else {
        result.desiredRank = elements.desiredRank.value;

        if (!result.desiredRank) {
          result.errors.push("Select a desired rank.");
        } else if (RANK_INDEX[result.desiredRank] <= RANK_INDEX[result.currentRank]) {
          result.errors.push("Desired rank must be higher than current rank.");
        } else {
          basePrice = priceBetweenRanks(result.currentRank, result.desiredRank);
          baseDays = estimateStandardDays(result.currentRank, result.desiredRank);
        }
      }

      const rewardContext = {
        tournamentMode: false,
        useMmrFlow: result.useMmrFlow,
        targetRank: result.desiredRank
      };

      result.rewardType = getDetectedRewardType(rewardContext);
      result.rewardExtra = getRewardExtra(result.rewardType);

      const modeMultiplier = MODE_MULTIPLIERS[mode] || 1;
      const duoMultiplier = boostType === "duo" ? (region === "NA" ? 1.2 : 1.3) : 1;

      if (modeMultiplier > 1) {
        result.multiplierLabels.push(`${mode} +25%`);
      }
      if (boostType === "duo") {
        result.multiplierLabels.push(region === "NA" ? "Duo +20%" : "Duo +30%");
      }
      if (result.rewardType === "gc") {
        result.multiplierLabels.push("GC Rewards");
      }
      if (result.rewardType === "ssl") {
        result.multiplierLabels.push("SSL Rewards");
      }

      result.subtotal = basePrice + result.rewardExtra;
      result.finalTotal = result.subtotal * modeMultiplier * duoMultiplier;
      result.deliveryDays = baseDays * (boostType === "duo" ? 2 : 1);
      result.valid = result.errors.length === 0;

      return result;
    }

    function renderSummary(result) {
      const rows = buildOrderRows(result, false);

      elements.summaryContent.innerHTML = `
        <div class="summary-card">
          <div class="mini-stack">
            ${rows.slice(0, Math.min(rows.length, 6)).map(([label, value]) => `
              <div class="mini-row">
                <span>${label}</span>
                <strong>${value}</strong>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="summary-card">
          <div class="mini-stack">
            ${rows.slice(Math.min(rows.length, 6)).map(([label, value]) => `
              <div class="mini-row">
                <span>${label}</span>
                <strong>${value}</strong>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="summary-card">
          <div class="mini-stack">
            <div class="mini-row">
              <span>Applied Pricing Rules</span>
              <strong>${result.multiplierLabels.length ? result.multiplierLabels.length : 1}</strong>
            </div>
            ${buildPills(result.multiplierLabels)}
          </div>
        </div>
      `;

      elements.priceValue.textContent = money.format(result.finalTotal || 0);
      elements.deliveryValue.textContent = result.deliveryDays ? formatDays(result.deliveryDays) : "--";
      bumpValue(elements.priceValue);
      bumpValue(elements.deliveryValue);
    }

    function renderInvalidState(errors) {
      elements.summaryContent.innerHTML = `
        <div class="summary-card">
          <div class="mini-stack">
            <div class="mini-row">
              <span>Order status</span>
              <strong>Waiting for valid input</strong>
            </div>
            <div class="summary-divider"></div>
            <p class="muted">${errors.join(" ") || "Complete the fields to see the full breakdown."}</p>
          </div>
        </div>
      `;
      elements.priceValue.textContent = "$0.00";
      elements.deliveryValue.textContent = "--";
    }

    function updateCalculator() {
      syncUiVisibility();
      const result = calculateOrder();

      if (result.valid) {
        renderSummary(result);
        elements.validationMessage.textContent = "";
        elements.placeOrderBtn.disabled = false;
        elements.placeOrderBtn.classList.remove("disabled");
      } else {
        renderInvalidState(result.errors);
        elements.validationMessage.textContent = result.errors.join(" ");
        elements.placeOrderBtn.disabled = true;
        elements.placeOrderBtn.classList.add("disabled");
      }
    }

    function openModal() {
      const result = calculateOrder();
      if (!result.valid) {
        updateCalculator();
        return;
      }

      const rows = buildOrderRows(result, true);

      elements.modalSummary.innerHTML = rows.map(([label, value]) => `
        <div class="summary-row">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `).join("");

      elements.orderModal.classList.add("open");
      elements.orderModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    }

    function closeModal() {
      elements.orderModal.classList.remove("open");
      elements.orderModal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }

    // ----------------------------------------------
    // Custom dropdowns (styled select replacements)
    // ----------------------------------------------
    function syncCustomSelectScrollbar(select) {
      const api = customSelectRegistry.get(select);
      if (!api) return;

      const { menu, scrollbar, thumb } = api;
      const hasOverflow = menu.scrollHeight > menu.clientHeight + 2;
      scrollbar.classList.toggle("has-overflow", hasOverflow);

      if (!hasOverflow) {
        thumb.style.transform = "translateY(0px)";
        thumb.style.height = `${Math.max(36, menu.clientHeight)}px`;
        return;
      }

      const trackHeight = scrollbar.clientHeight;
      const thumbHeight = Math.max(36, (menu.clientHeight / menu.scrollHeight) * trackHeight);
      const maxScroll = menu.scrollHeight - menu.clientHeight;
      const maxThumbTop = trackHeight - thumbHeight;
      const thumbTop = maxScroll > 0 ? (menu.scrollTop / maxScroll) * maxThumbTop : 0;

      thumb.style.height = `${thumbHeight}px`;
      thumb.style.transform = `translateY(${thumbTop}px)`;
    }

    function createCustomSelect(select) {
      const mount = document.querySelector(`.custom-select[data-for="${select.id}"]`);
      if (!mount) return;

      const label = mount.dataset.label || select.name || "Select";
      const icon = mount.dataset.icon || "•";

      mount.innerHTML = `
        <button type="button" class="select-trigger" aria-haspopup="listbox" aria-expanded="false">
          <span class="left">
            <span class="select-icon">${icon}</span>
            <span class="select-text">
              <span class="select-label">${label}</span>
              <span class="select-value"></span>
            </span>
          </span>
          <span class="select-chevron" aria-hidden="true"></span>
        </button>
        <div class="select-menu-shell">
          <div class="select-menu" role="listbox"></div>
          <div class="select-scrollbar" aria-hidden="true">
            <div class="select-scroll-thumb"></div>
          </div>
        </div>
      `;

      const trigger = mount.querySelector(".select-trigger");
      const valueEl = mount.querySelector(".select-value");
      const menu = mount.querySelector(".select-menu");
      const scrollbar = mount.querySelector(".select-scrollbar");
      const thumb = mount.querySelector(".select-scroll-thumb");

      const api = {
        mount,
        trigger,
        valueEl,
        menu,
        scrollbar,
        thumb,
        open() {
          document.querySelectorAll(".custom-select.open").forEach(node => {
            if (node !== mount) {
              node.classList.remove("open");
              const t = node.querySelector(".select-trigger");
              if (t) t.setAttribute("aria-expanded", "false");
            }
          });
          mount.classList.add("open");
          trigger.setAttribute("aria-expanded", "true");
          requestAnimationFrame(() => syncCustomSelectScrollbar(select));
        },
        close() {
          mount.classList.remove("open");
          trigger.setAttribute("aria-expanded", "false");
        },
        toggle() {
          if (mount.classList.contains("open")) api.close();
          else api.open();
        }
      };

      trigger.addEventListener("click", api.toggle);
      menu.addEventListener("scroll", () => syncCustomSelectScrollbar(select));
      window.addEventListener("resize", () => syncCustomSelectScrollbar(select));

      customSelectRegistry.set(select, api);
      refreshCustomSelect(select);
    }

    function refreshCustomSelect(select) {
      const api = customSelectRegistry.get(select);
      if (!api) return;

      const options = [...select.options];
      const selected = options.find(option => option.value === select.value) || options[0];

      api.valueEl.textContent = selected ? selected.textContent : "Select";

      if (!options.length) {
        api.menu.innerHTML = `<div class="select-empty">No options available</div>`;
        syncCustomSelectScrollbar(select);
        return;
      }

      api.menu.innerHTML = options.map(option => `
        <button
          type="button"
          class="select-option ${option.value === select.value ? "selected" : ""}"
          data-value="${option.value}"
          ${option.disabled ? "disabled" : ""}
          role="option"
          aria-selected="${option.value === select.value ? "true" : "false"}"
        >
          <span>${option.textContent}</span>
          ${option.value === select.value ? "<small>Selected</small>" : "<small>&nbsp;</small>"}
        </button>
      `).join("");

      api.menu.querySelectorAll(".select-option").forEach(button => {
        button.addEventListener("click", () => {
          select.value = button.dataset.value;
          refreshCustomSelect(select);
          api.close();
          select.dispatchEvent(new Event("change", { bubbles: true }));
          select.dispatchEvent(new Event("input", { bubbles: true }));
        });
      });

      requestAnimationFrame(() => syncCustomSelectScrollbar(select));
    }

    function initCustomSelects() {
      document.querySelectorAll(".native-select").forEach(createCustomSelect);

      document.addEventListener("click", (event) => {
        if (!event.target.closest(".custom-select")) {
          document.querySelectorAll(".custom-select.open").forEach(node => {
            node.classList.remove("open");
            const trigger = node.querySelector(".select-trigger");
            if (trigger) trigger.setAttribute("aria-expanded", "false");
          });
        }
      });
    }

    // -------------------------
    // Event bindings
    // -------------------------
    elements.boostButtons.forEach(button => {
      button.addEventListener("click", () => {
        elements.boostType.value = button.dataset.value;
        syncBoostButtons();
        updateCalculator();
      });
    });

    elements.rewardToggle.addEventListener("click", () => {
      const context = getTargetContext();
      const rewardType = getDetectedRewardType(context);
      if (context.tournamentMode || rewardType === "none") return;
      rewardsEnabled = !rewardsEnabled;
      syncRewardToggleState();
      updateCalculator();
    });

    elements.mode.addEventListener("change", () => {
      populateRankSelects();
      syncRewardToggleState();
      updateCalculator();
    });

    elements.currentRank.addEventListener("change", () => {
      syncDesiredRankOptions(elements.desiredRank.value);
      syncRewardToggleState();
      updateCalculator();
    });

    [
      elements.desiredRank,
      elements.region,
      elements.tournamentOption,
      elements.currentMmr,
      elements.desiredMmr
    ].forEach(element => {
      element.addEventListener("input", () => {
        syncRewardToggleState();
        updateCalculator();
      });
      element.addEventListener("change", () => {
        syncRewardToggleState();
        updateCalculator();
      });
    });

    elements.placeOrderBtn.addEventListener("click", openModal);
    elements.closeModalBtn.addEventListener("click", closeModal);

    elements.orderModal.addEventListener("click", (event) => {
      if (event.target === elements.orderModal) {
        closeModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
    });

    // -------------------------
    // Initial boot
    // -------------------------
    populateTournamentOptions();
    initCustomSelects();

    elements.mode.value = "2v2";
    refreshCustomSelect(elements.mode);

    populateRankSelects();

    if ([...elements.currentRank.options].some(option => option.value === "Diamond 2")) {
      elements.currentRank.value = "Diamond 2";
      refreshCustomSelect(elements.currentRank);
    }

    syncDesiredRankOptions("Champion 1");
    elements.tournamentOption.value = "bronze-win";
    refreshCustomSelect(elements.tournamentOption);

    elements.region.value = "";
    refreshCustomSelect(elements.region);

    syncBoostButtons();
    syncRewardToggleState();
    updateCalculator();
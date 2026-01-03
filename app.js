const state = {
  data: null,
  metricFamily: "latency",
  opClass: "all",
  opId: null,
  selectedDevices: new Set(),
};

const byId = (id) => document.getElementById(id);

const formatValue = (value, unit, aggregation) => {
  if (value === null || value === undefined) {
    return "—";
  }
  const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(2);
  const agg = aggregation ? ` (${aggregation})` : "";
  return `${formatted} ${unit}${agg}`;
};

const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const getOp = (opId) => state.data.ops.find((op) => op.id === opId);

const getDevice = (deviceId) => state.data.devices.find((device) => device.id === deviceId);

const matchesOpClass = (op, opClass) => opClass === "all" || op.class === opClass;

const measurementMatches = (measurement) => {
  if (measurement.metric_family !== state.metricFamily) {
    return false;
  }
  if (state.opId && measurement.op_id !== state.opId) {
    return false;
  }
  if (!state.selectedDevices.has(measurement.device_id)) {
    return false;
  }
  return true;
};

const availableOpsForSelection = () => {
  const opsById = new Map(state.data.ops.map((op) => [op.id, op]));
  const availableIds = new Set(
    state.data.measurements
      .filter((m) => m.metric_family === state.metricFamily)
      .map((m) => m.op_id)
  );
  return [...availableIds]
    .map((id) => opsById.get(id))
    .filter(Boolean)
    .filter((op) => matchesOpClass(op, state.opClass));
};

const renderStats = () => {
  byId("statDevices").textContent = state.data.devices.length;
  byId("statOps").textContent = state.data.ops.length;
  byId("statMeasurements").textContent = state.data.measurements.length;
  byId("updatedAt").textContent = state.data.updated_at || "—";

  const hasPlaceholder = state.data.measurements.some(
    (m) => m.source && (m.source.kind === "placeholder" || m.source.confidence === "placeholder")
  );
  if (!hasPlaceholder) {
    byId("dataBanner").hidden = true;
  }
};

const renderOpClassOptions = () => {
  const opClassSelect = byId("opClass");
  const classes = Array.from(new Set(state.data.ops.map((op) => op.class))).sort();
  classes.forEach((className) => {
    const option = document.createElement("option");
    option.value = className;
    option.textContent = titleCase(className);
    opClassSelect.appendChild(option);
  });
};

const renderOpOptions = () => {
  const opSelect = byId("opSelect");
  const availableOps = availableOpsForSelection();
  opSelect.innerHTML = "";

  if (availableOps.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No ops available";
    opSelect.appendChild(option);
    opSelect.disabled = true;
    state.opId = null;
    return;
  }

  opSelect.disabled = false;
  availableOps.forEach((op) => {
    const option = document.createElement("option");
    option.value = op.id;
    option.textContent = `${op.name} (${op.id})`;
    opSelect.appendChild(option);
  });

  if (!availableOps.some((op) => op.id === state.opId)) {
    state.opId = availableOps[0].id;
  }
  opSelect.value = state.opId;
};

const renderDeviceList = () => {
  const list = byId("deviceList");
  if (list.children.length > 0) {
    return;
  }
  state.data.devices.forEach((device) => {
    const wrapper = document.createElement("label");
    wrapper.className = "device-item";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    input.value = device.id;
    input.addEventListener("change", () => {
      if (input.checked) {
        state.selectedDevices.add(device.id);
      } else {
        state.selectedDevices.delete(device.id);
      }
      renderChart();
      renderMeasurements();
    });
    const span = document.createElement("span");
    span.textContent = `${device.name} · ${device.type}`;
    wrapper.appendChild(input);
    wrapper.appendChild(span);
    list.appendChild(wrapper);
  });
};

const renderChart = () => {
  const chart = byId("chart");
  const empty = byId("chartEmpty");
  const unitPill = byId("unitPill");
  chart.innerHTML = "";

  const op = state.opId ? getOp(state.opId) : null;
  const subtitle = byId("chartSubtitle");
  subtitle.textContent = op
    ? `${op.name} · ${titleCase(state.metricFamily)} measurements`
    : "Select an op to visualize results across devices.";

  if (!state.opId) {
    empty.hidden = false;
    unitPill.textContent = "—";
    return;
  }

  const measurements = state.data.measurements.filter(measurementMatches);
  const withValues = measurements.filter((m) => m.value !== null && m.value !== undefined);
  if (withValues.length === 0) {
    empty.hidden = false;
    unitPill.textContent = "—";
    return;
  }

  empty.hidden = true;
  const maxValue = Math.max(...withValues.map((m) => m.value));
  const units = Array.from(new Set(withValues.map((m) => m.unit)));
  unitPill.textContent = units.length === 1 ? units[0] : "mixed units";

  withValues
    .sort((a, b) => b.value - a.value)
    .forEach((measurement) => {
      const device = getDevice(measurement.device_id);
      const row = document.createElement("div");
      row.className = "chart-row";
      const label = document.createElement("div");
      label.className = "chart-label";
      label.textContent = device ? device.name : measurement.device_id;

      const bar = document.createElement("div");
      bar.className = "chart-bar";
      const pct = maxValue > 0 ? (measurement.value / maxValue) * 100 : 0;
      bar.style.setProperty("--pct", `${pct.toFixed(1)}%`);
      bar.title = `${measurement.value} ${measurement.unit}`;

      const value = document.createElement("div");
      value.className = "chart-value";
      value.textContent = formatValue(measurement.value, measurement.unit, measurement.aggregation);

      row.appendChild(label);
      row.appendChild(bar);
      row.appendChild(value);
      chart.appendChild(row);
    });

};

const renderMeasurements = () => {
  const list = byId("measurementList");
  list.innerHTML = "";

  const measurements = state.data.measurements.filter(measurementMatches);
  if (measurements.length === 0) {
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = "No measurements match this selection.";
    list.appendChild(empty);
    return;
  }

  measurements.forEach((measurement) => {
    const device = getDevice(measurement.device_id);
    const op = getOp(measurement.op_id);

    const card = document.createElement("div");
    card.className = "measurement-card";

    const header = document.createElement("div");
    header.className = "measurement-header";

    const title = document.createElement("div");
    title.className = "measurement-title";
    title.textContent = `${op ? op.name : measurement.op_id} · ${device ? device.name : measurement.device_id}`;

    const meta = document.createElement("div");
    meta.className = "measurement-meta";
    meta.textContent = formatValue(measurement.value, measurement.unit, measurement.aggregation);

    header.appendChild(title);
    header.appendChild(meta);

    const chips = document.createElement("div");
    chips.className = "chips";
    (measurement.tags || []).forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = tag;
      chips.appendChild(chip);
    });

    const details = document.createElement("div");
    details.className = "details-grid";

    const addDetail = (label, value) => {
      const row = document.createElement("div");
      row.innerHTML = `<span>${label}</span><br />${value}`;
      details.appendChild(row);
    };

    addDetail("Metric family", titleCase(measurement.metric_family));
    addDetail("Measured", measurement.measured_at || "—");
    addDetail("Aggregation", measurement.aggregation || "—");
    addDetail("Confidence", measurement.source?.confidence || "—");

    const conditionKeys = measurement.conditions ? Object.keys(measurement.conditions) : [];
    if (conditionKeys.length > 0) {
      conditionKeys.forEach((key) => {
        addDetail(`Condition · ${key}`, measurement.conditions[key]);
      });
    }

    const recipe = document.createElement("div");
    recipe.className = "recipe";
    const summary = document.createElement("div");
    summary.innerHTML = `<strong>Recipe:</strong> ${measurement.recipe?.summary || "—"}`;
    recipe.appendChild(summary);

    if (measurement.recipe?.steps?.length) {
      const listEl = document.createElement("ol");
      measurement.recipe.steps.forEach((step) => {
        const item = document.createElement("li");
        const run = step.run ? `<span class=\"code\">${step.run}</span>` : "";
        item.innerHTML = `${step.type}: ${run} ${step.expected ? `→ ${step.expected}` : ""}`;
        listEl.appendChild(item);
      });
      recipe.appendChild(listEl);
    }

    if (measurement.recipe?.notes) {
      const notes = document.createElement("div");
      notes.textContent = measurement.recipe.notes;
      recipe.appendChild(notes);
    }

    card.appendChild(header);
    card.appendChild(chips);
    card.appendChild(details);
    card.appendChild(recipe);
    list.appendChild(card);
  });
};

const renderAll = () => {
  renderOpOptions();
  renderChart();
  renderMeasurements();
};

const init = (data) => {
  state.data = data;
  state.selectedDevices = new Set(data.devices.map((device) => device.id));

  renderStats();
  renderOpClassOptions();
  renderDeviceList();
  renderAll();

  document.querySelectorAll("#metricFamily button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#metricFamily button").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      state.metricFamily = button.dataset.value;
      renderAll();
    });
  });

  byId("opClass").addEventListener("change", (event) => {
    state.opClass = event.target.value;
    renderAll();
  });

  byId("opSelect").addEventListener("change", (event) => {
    state.opId = event.target.value;
    renderChart();
    renderMeasurements();
  });
};

fetch("./data/metrics.json")
  .then((response) => response.json())
  .then((data) => init(data))
  .catch((error) => {
    const banner = byId("dataBanner");
    if (banner) {
      banner.textContent = `Failed to load dataset: ${error}`;
    }
  });

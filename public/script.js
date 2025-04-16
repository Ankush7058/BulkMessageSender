const numberInput = document.getElementById("number-input");
const numberBox = document.getElementById("number-box");
const numberCounter = document.getElementById("number-counter");
let numbers = [];

// ✅ Handle typing input
numberInput.addEventListener("input", function () {
    let enteredNumber = numberInput.value.trim();

    if (/^\d{10}$/.test(enteredNumber)) {
        addNumberTag(enteredNumber);
        numberInput.value = "";
    }
});

// ✅ Handle pasting multiple numbers
numberInput.addEventListener("paste", function (event) {
    event.preventDefault();
    let pastedData = event.clipboardData.getData("text");
    let extractedNumbers = pastedData.match(/\d{10}/g);

    if (extractedNumbers) {
        extractedNumbers.forEach(num => addNumberTag(num));
    }

    numberInput.value = "";
});

// ✅ Add a number tag in the UI
function addNumberTag(number) {
    if (!numbers.includes(number)) {
        numbers.push(number);

        const tag = document.createElement("div");
        tag.classList.add("number-tag");
        tag.innerHTML = `${number} <span class="remove-btn" onclick="removeNumber('${number}', this)">✖</span>`;

        numberBox.appendChild(tag);
        updateCounter();
    }
}

// ✅ Remove number from list
function removeNumber(number, element) {
    numbers = numbers.filter(num => num !== number);
    element.parentElement.remove();
    updateCounter();
}

// ✅ Update number counter
function updateCounter() {
    numberCounter.textContent = `You have added ${numbers.length} number${numbers.length !== 1 ? "s" : ""}`;
}

// ✅ Delete all numbers
function deleteAllNumbers() {
    numbers = [];
    numberBox.innerHTML = "";
    updateCounter();
}

// ✅ Upload Excel file to import numbers
async function uploadExcel() {
    const fileInput = document.getElementById("excel-file");
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select an Excel file.");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch("http://localhost:5000/upload-excel", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.numbers.length > 0) {
            data.numbers.forEach(num => addNumberTag(num));
            alert("Numbers imported successfully!");
        } else {
            alert("No valid numbers found in the Excel file.");
        }
    } catch (error) {
        console.error("❌ Error uploading Excel file:", error);
        alert("Failed to import numbers.");
    }
}

// ✅ Download report as Excel
function downloadReport() {
    if (!window.data || !window.data.results || window.data.results.length === 0) {
        alert("No report available to download.");
        return;
    }

    const resultsWithHeaders = window.data.results.map(result => ({
        "Phone Number": result.number,
        "Status": result.status,
        "Timestamp": result.time
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(resultsWithHeaders);
    XLSX.utils.book_append_sheet(wb, ws, "Message Report");

    XLSX.writeFile(wb, "message_report.xlsx");
}

// ✅ Fetch WhatsApp groups
async function fetchWhatsAppGroups() {
    try {
        const response = await fetch("http://localhost:5000/get-groups");
        const data = await response.json();

        const groupSelect = document.getElementById("group-select");
        groupSelect.innerHTML = `<option value="">Select a Group</option>`;

        if (data.length === 0) {
            alert("No groups found. Make sure you are in at least one WhatsApp group.");
            return;
        }

        data.forEach(group => {
            const option = document.createElement("option");
            option.value = group.id;
            option.textContent = group.name;
            groupSelect.appendChild(option);
        });

    } catch (error) {
        console.error("❌ Error fetching WhatsApp groups:", error);
        alert("Failed to load groups. Check the server.");
    }
}

// ✅ Send message to WhatsApp Group
async function sendGroupMessage() {
    const groupId = document.getElementById("group-select").value;
    const message = document.getElementById("message").value;
    const fileInput = document.getElementById("file");
    const responseDiv = document.getElementById("response");

    if (!groupId) {
        alert("⚠️ Please select a valid WhatsApp group.");
        return;
    }
    if (!message.trim()) {
        alert("⚠️ Please enter a message.");
        return;
    }

    responseDiv.innerHTML = "Sending group message... ⏳";

    try {
        let formData = new FormData();
        formData.append("groupId", groupId);
        formData.append("message", message);

        if (fileInput.files.length > 0) {
            formData.append("file", fileInput.files[0]);
        }

        const response = await fetch("http://localhost:5000/send-group-message", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        responseDiv.innerHTML = `✅ Message sent to group: ${data.group}`;
        responseDiv.style.color = "green";

    } catch (error) {
        responseDiv.innerHTML = "❌ Error sending group message.";
        responseDiv.style.color = "red";
        console.error("❌ Error:", error);
    }
}

// ✅ Send message to Individual Numbers
async function sendBulkMessage() {
    const message = document.getElementById("message").value;
    const fileInput = document.getElementById("file");
    const responseDiv = document.getElementById("response");

    if (numbers.length === 0) {
        responseDiv.innerHTML = "⚠️ Please enter numbers.";
        responseDiv.style.color = "red";
        return;
    }
    if (!message.trim()) {
        alert("⚠️ Please enter a message.");
        return;
    }

    responseDiv.innerHTML = "Sending messages... ⏳";

    try {
        let formData = new FormData();
        formData.append("numbers", JSON.stringify(numbers));
        formData.append("message", message);

        if (fileInput.files.length > 0) {
            formData.append("file", fileInput.files[0]);
        }

        const response = await fetch("http://localhost:5000/send-media", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        window.data = data;

        responseDiv.innerHTML = "✅ Messages sent successfully!";
        responseDiv.style.color = "green";

    } catch (error) {
        responseDiv.innerHTML = "❌ Error sending messages.";
        responseDiv.style.color = "red";
        console.error("❌ Error:", error);
    }
}

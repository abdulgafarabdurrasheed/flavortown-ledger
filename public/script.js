let usersData = [];
let currentSort = 'earned';
let sortDesc = true;

async function loadData() {
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error('Data file not found');
    
    const data = await res.json();
    usersData = Object.values(data.users || {});
    
    if (usersData.length === 0) {
      document.getElementById('ledger-body').innerHTML = '<tr><td colspan="4" class="loading">No data available yet. Waiting for the bot to run...</td></tr>';
      return;
    }

    renderTable();
  } catch (err) {
    console.error(err);
    document.getElementById('ledger-body').innerHTML = '<tr><td colspan="4" class="loading">⚠️ Failed to load data. The ledger might still be initializing.</td></tr>';
  }
}

function renderTable() {
  // Sort the data
  usersData.sort((a, b) => {
    const valA = a[currentSort] || 0;
    const valB = b[currentSort] || 0;
    return sortDesc ? valB - valA : valA - valB;
  });

  const tbody = document.getElementById('ledger-body');
  tbody.innerHTML = '';
  
  usersData.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="user-id">${u.id}</span></td>
      <td class="earned">+${u.earned.toLocaleString()}</td>
      <td class="spent">-${u.spent.toLocaleString()}</td>
      <td class="balance">${u.balance.toLocaleString()} 🍪</td>
    `;
    tbody.appendChild(tr);
  });
}

// Store original header labels for sort indicator updates
document.querySelectorAll('.sortable').forEach(th => {
  th.dataset.label = th.innerText.replace(' ▼', '').replace(' ▲', '').trim();
});

// Set up sorting logic
document.querySelectorAll('.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const sortKey = th.dataset.sort;
    
    if (currentSort === sortKey) {
      sortDesc = !sortDesc;
    } else {
      currentSort = sortKey;
      sortDesc = true; // Default to descending when switching columns
    }
    
    // Update headers UI
    document.querySelectorAll('.sortable').forEach(el => {
      el.classList.remove('active');
      el.innerText = el.dataset.label;
    });
    
    th.classList.add('active');
    th.innerText = th.dataset.label + (sortDesc ? ' ▼' : ' ▲');
    
    renderTable();
  });
});

// Initialize
loadData();

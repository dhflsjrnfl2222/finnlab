/**
 * FinnLab - Main Page (Index) JavaScript
 * Handles filtering and tank card management
 */

document.addEventListener('DOMContentLoaded', () => {
  // Setup quick delete handler for tank cards
  window.deleteTankCard = async (id, name) => {
    const confirmed = confirm(`정말 '${name}' 수조를 삭제하시겠습니까?`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/tanks/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();

      if (data.success) {
        // Reload page to reflect updated grid and ensure + card is at end
        window.location.reload();
      } else {
        alert(data.error || '수조 삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('Delete tank failed:', err);
      alert('서버와 통신 중 오류가 발생했습니다.');
    }
  };
});

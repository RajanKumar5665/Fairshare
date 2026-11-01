import { useCallback, useEffect, useState } from 'react';
import { adminService } from '../services/adminService';

export function useAdminData() {
  const [overview, setOverview] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewData, roomsData] = await Promise.all([
        adminService.getOverview(),
        adminService.getRooms(),
      ]);
      setOverview(overviewData);
      setRooms(roomsData.rooms || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  function updateRoom(roomId, updater) {
    setRooms((current) => current.map((room) => (
      room._id === roomId ? updater(room) : room
    )));
  }

  return { overview, rooms, loading, reload, setRooms, updateRoom };
}

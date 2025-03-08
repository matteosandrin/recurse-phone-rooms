<script lang="ts">
  import { onMount } from 'svelte';
  import * as EventCalendar from '@event-calendar/core';
  import TimeGrid from '@event-calendar/time-grid';
  import { db } from '../lib/db';

  let calendarEl: HTMLElement;
  let events = [];
  let rooms = [];

  async function loadRooms() {
    const result = await db.query('SELECT * FROM rooms');
    rooms = result.rows || [];
  }

  async function loadBookings() {
    const result = await db.query(`
      SELECT b.*, r.name as room_name, u.email as user_email 
      FROM bookings b 
      JOIN rooms r ON b.room_id = r.id 
      JOIN users u ON b.user_id = u.id
    `);
    
    events = (result.rows || []).map(booking => ({
      id: booking.id,
      start: booking.start_time,
      end: booking.end_time,
      title: `${booking.room_name} - ${booking.user_email}`,
      resourceId: booking.room_id
    }));
  }

  onMount(async () => {
    await Promise.all([loadRooms(), loadBookings()]);
    
    const calendar = new EventCalendar.Calendar({
      target: calendarEl,
      plugins: [TimeGrid],
      options: {
        view: 'timeGridWeek',
        events,
        resources: rooms.map(room => ({
          id: room.id,
          title: room.name
        }))
      }
    });

    return () => {
      calendar.destroy();
    };
  });
</script>

<div class="container mx-auto p-4">
  <h1 class="text-2xl font-bold mb-4">Room Bookings</h1>
  <div bind:this={calendarEl} class="h-[600px]"></div>
</div>
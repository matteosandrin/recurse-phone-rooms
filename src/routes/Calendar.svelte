<script lang="ts">
  import { onMount } from "svelte";
  import { db } from "../lib/browserDb";
  import type { Room, Booking } from "../lib/browserDb";
  import { user } from "../lib/auth";
  import { writable } from "svelte/store";

  // Simplified approach - just show rooms in a basic layout
  let rooms: Room[] = [];
  let filteredRooms: Room[] = [];
  let bookings: Booking[] = [];
  let isLoading = true;
  let error: string | null = null;
  let debugInfo: {
    roomsCount: number;
    eventsCount: number;
    userInfo: Record<string, any> | null;
  } = { roomsCount: 0, eventsCount: 0, userInfo: null };

  // Calendar state
  const now = new Date();
  let currentDate = new Date();
  let currentView = "week"; // "day", "week", "month"

  // Create 15-minute time slots instead of hourly
  const hourSlots = Array.from({ length: 17 }, (_, i) => i + 8); // 8am to 12am (8-24)
  const quarterHours = [0, 15, 30, 45];
  const timeSlots = hourSlots.flatMap(hour =>
    quarterHours.map(minutes => ({ hour, minutes }))
  );

  let selectedRoom: Room | null = null;
  let selectedStartTime: Date | null = null;
  let selectedEndTime: Date | null = null;
  let bookingNotes = "";
  let isBookingFormVisible = false;
  let isSubmitting = false;
  let bookingSuccess = false;
  let bookingError: string | null = null;

  // Drag-to-create variables
  let isDragging = false;
  let dragStartTime: Date | null = null;
  let dragEndTime: Date | null = null;
  let dragStartCell: { day: Date; slotIndex: number; roomId: number } | null = null;
  let dragCurrentCell: { day: Date; slotIndex: number; roomId: number } | null = null;

  // Week view variables
  let weekDays: Date[] = [];
  let weekBookings: Record<string, Booking[]> = {};

  // Room filter - only allow "green phone room" and "Lovelace"
  // Commenting out the strict filter for now
  // const allowedRoomNames = ["green phone room", "Lovelace"];

  async function loadData() {
    try {
      isLoading = true;
      error = null;
      console.log("Loading data...");
      console.log("Current user:", $user);

      debugInfo.userInfo = $user
        ? {
            id: $user.id,
            email: $user.email,
            name: $user.name,
          }
        : null;

      // Load rooms and bookings in parallel
      const [roomsData, bookingsData] = await Promise.all([
        db.getRooms(),
        db.getBookings(),
      ]);

      console.log("Rooms loaded:", roomsData);
      // Log the actual room names so we can see what's available
      console.log(
        "Room names:",
        roomsData.map((room) => room.name),
      );
      console.log("Bookings loaded:", bookingsData);

      rooms = roomsData;
      // Show all rooms for now instead of filtering
      filteredRooms = roomsData;

      // Original filtering logic for reference:
      /*
      filteredRooms = rooms.filter((room) =>
        allowedRoomNames.some((name) =>
          room.name.toLowerCase().includes(name.toLowerCase()),
        ),
      );
      */

      bookings = bookingsData;

      debugInfo.roomsCount = rooms.length;
      debugInfo.eventsCount = bookingsData.length;

      // Generate the week view
      generateWeekView();
    } catch (err) {
      console.error("Error loading data:", err);
      error =
        err instanceof Error ? err.message : "Failed to load calendar data";
    } finally {
      isLoading = false;
    }
  }

  // Load data on mount
  onMount(() => {
    console.log("Calendar component mounted");
    loadData(); // No need to await here

    // Add event listener for mouseup outside the component
    document.addEventListener("mouseup", handleGlobalMouseUp);

    // Return cleanup function - this fixes the TypeScript error
    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  });

  function handleSignOut() {
    import("../lib/auth").then(({ signOut }) => {
      signOut();
    });
  }

  // Format a date for display
  function formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  // Format a time for display
  function formatTime(date: Date | string): string {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  // Format time from slot object
  function formatTimeSlot(slot: { hour: number; minutes: number }): string {
    const hour = slot.hour > 12 ? slot.hour - 12 : slot.hour;
    const period = slot.hour >= 12 ? 'PM' : 'AM';
    const hourStr = hour === 0 ? '12' : hour.toString();
    const minutesStr = slot.minutes.toString().padStart(2, '0');
    return `${hourStr}:${minutesStr} ${period}`;
  }

  // Generate the week view starting from the currentDate
  function generateWeekView() {
    // Reset week days
    weekDays = [];
    weekBookings = {};

    // Get the start of the week (Sunday)
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    // Generate the 7 days of the week
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      weekDays.push(day);

      // Initialize bookings array for this day
      const dayKey = day.toISOString().split("T")[0];
      weekBookings[dayKey] = [];
    }

    // Organize bookings by day
    bookings.forEach((booking) => {
      const bookingDate = new Date(booking.start_time);
      const dayKey = bookingDate.toISOString().split("T")[0];

      if (weekBookings[dayKey]) {
        weekBookings[dayKey].push(booking);
      }
    });
  }

  // Navigate to previous week
  function prevWeek() {
    currentDate.setDate(currentDate.getDate() - 7);
    currentDate = new Date(currentDate); // Trigger reactivity
    generateWeekView();
  }

  // Navigate to next week
  function nextWeek() {
    currentDate.setDate(currentDate.getDate() + 7);
    currentDate = new Date(currentDate); // Trigger reactivity
    generateWeekView();
  }

  // Navigate to today
  function goToToday() {
    currentDate = new Date();
    generateWeekView();
  }

  // Get column span for a booking in the grid
  function getBookingTimeSlot(booking: Booking): {
    start: number;
    end: number;
    room: string;
  } {
    const startDate = new Date(booking.start_time);
    const endDate = new Date(booking.end_time);

    const startHour = startDate.getHours();
    const endHour = endDate.getHours() + (endDate.getMinutes() > 0 ? 1 : 0);

    const room = rooms.find((r) => r.id === booking.room_id)?.name || "Unknown";

    return {
      start: startHour < 8 ? 0 : startHour - 8, // Index in our grid
      end: endHour < 8 ? 0 : endHour - 8, // Index in our grid
      room,
    };
  }

  // Check if a time slot belongs to a booking
  function hasBookingAt(
    day: Date,
    slotIndex: number,
    roomId: number,
  ): Booking | null {
    const dayKey = day.toISOString().split("T")[0];
    const dayBookings = weekBookings[dayKey] || [];

    const slotTime = new Date(day);
    const { hour, minutes } = timeSlots[slotIndex];
    slotTime.setHours(hour, minutes, 0, 0);

    // Get the end of this time slot
    const slotEndTime = new Date(slotTime);
    slotEndTime.setMinutes(slotEndTime.getMinutes() + 15);

    return (
      dayBookings.find((booking) => {
        if (booking.room_id !== roomId) return false;

        const startDate = new Date(booking.start_time);
        const endDate = new Date(booking.end_time);

        // Check if the slot falls within the booking time
        return slotTime < endDate && slotEndTime > startDate;
      }) || null
    );
  }

  // Handle mouse down on a cell to start dragging
  function handleMouseDown(day: Date, slotIndex: number, roomId: number) {
    // Check if there's already a booking at this time
    const existingBooking = hasBookingAt(day, slotIndex, roomId);
    if (existingBooking) return;

    // Start the drag operation
    isDragging = true;

    // Create start date from the day and time slot
    const { hour, minutes } = timeSlots[slotIndex];
    const startDate = new Date(day);
    startDate.setHours(hour, minutes, 0, 0);

    // Set initial drag times
    dragStartTime = startDate;
    dragEndTime = new Date(startDate);
    dragEndTime.setMinutes(dragEndTime.getMinutes() + 15);

    dragStartCell = { day, slotIndex, roomId };
    dragCurrentCell = { day, slotIndex, roomId };

    selectedRoom = rooms.find((r) => r.id === roomId) || null;
  }

  // Handle mouse enter while dragging
  function handleMouseEnter(day: Date, slotIndex: number, roomId: number) {
    if (!isDragging || !dragStartCell || dragStartCell.roomId !== roomId)
      return;

    // Update the current cell and end time
    dragCurrentCell = { day, slotIndex, roomId };

    // Make sure the dates are on the same day
    const isSameDay = day.toDateString() === dragStartCell.day.toDateString();
    if (!isSameDay) return;

    // Create a date object for the current slot time
    const { hour, minutes } = timeSlots[slotIndex];
    const currentSlotTime = new Date(day);
    currentSlotTime.setHours(hour, minutes, 0, 0);

    // Create a date object for the start slot time
    const startSlotObj = timeSlots[dragStartCell.slotIndex];
    const startSlotTime = new Date(dragStartCell.day);
    startSlotTime.setHours(startSlotObj.hour, startSlotObj.minutes, 0, 0);

    if (currentSlotTime >= startSlotTime) {
      // Dragging forward - set end time to end of current slot
      const endTime = new Date(currentSlotTime);
      endTime.setMinutes(endTime.getMinutes() + 15);
      dragStartTime = startSlotTime;
      dragEndTime = endTime;
    } else {
      // Dragging backward - swap start and end
      const endTime = new Date(startSlotTime);
      endTime.setMinutes(endTime.getMinutes() + 15);
      dragStartTime = currentSlotTime;
      dragEndTime = endTime;
    }
  }

  // Handle mouse up to end dragging
  function handleMouseUp() {
    if (!isDragging || !dragStartTime || !dragEndTime || !selectedRoom) return;

    // Set the selected times
    selectedStartTime = dragStartTime;
    selectedEndTime = dragEndTime;

    // Show the booking form
    openBookingForm();

    // Reset drag state
    isDragging = false;
    dragStartCell = null;
    dragCurrentCell = null;
  }

  // Handle global mouse up (in case mouse is released outside calendar)
  function handleGlobalMouseUp() {
    if (isDragging) {
      handleMouseUp();
    }
  }

  // Check if a cell is being dragged over
  function isDraggedCell(day: Date, slotIndex: number, roomId: number): boolean {
    if (
      !isDragging ||
      !dragStartCell ||
      !dragCurrentCell ||
      dragStartCell.roomId !== roomId
    ) {
      return false;
    }

    // Check if the cell is on the same day
    const cellDate = new Date(day);
    const startCellDate = new Date(dragStartCell.day);
    if (cellDate.toDateString() !== startCellDate.toDateString()) {
      return false;
    }

    // Determine the range of slots being dragged
    let startSlotIndex, endSlotIndex;
    if (dragStartCell.slotIndex <= dragCurrentCell.slotIndex) {
      startSlotIndex = dragStartCell.slotIndex;
      endSlotIndex = dragCurrentCell.slotIndex;
    } else {
      startSlotIndex = dragCurrentCell.slotIndex;
      endSlotIndex = dragStartCell.slotIndex;
    }

    // Check if this cell is within the dragged range
    return slotIndex >= startSlotIndex && slotIndex <= endSlotIndex;
  }

  // Start selecting a time slot
  function startSelection(day: Date, slotIndex: number, roomId: number) {
    // Create a date object from the day and time slot
    const { hour, minutes } = timeSlots[slotIndex];
    const startDate = new Date(day);
    startDate.setHours(hour, minutes, 0, 0);

    // Check if there's already a booking at this time
    const existingBooking = hasBookingAt(day, slotIndex, roomId);
    if (existingBooking) return;

    selectedStartTime = startDate;
    selectedEndTime = new Date(startDate);
    selectedEndTime.setMinutes(selectedEndTime.getMinutes() + 30); // Default to 30-minute meeting
    selectedRoom = rooms.find((r) => r.id === roomId) || null;

    // Show the booking form
    openBookingForm();
  }

  // Open the booking form
  function openBookingForm() {
    isBookingFormVisible = true;
    bookingNotes = "";
    bookingSuccess = false;
    bookingError = null;
  }

  function closeBookingForm() {
    isBookingFormVisible = false;
    selectedStartTime = null;
    selectedEndTime = null;
    selectedRoom = null;
  }

  async function handleBookingSubmit() {
    if (!$user || !selectedRoom || !selectedStartTime || !selectedEndTime)
      return;

    try {
      isSubmitting = true;
      bookingError = null;

      // Check if time slot is available
      const isAvailable = await db.isTimeSlotAvailable(
        selectedRoom.id,
        selectedStartTime,
        selectedEndTime,
      );

      if (!isAvailable) {
        bookingError =
          "This time slot is already booked. Please select a different time.";
        return;
      }

      // Create the booking
      const booking = {
        user_id: parseInt($user.id),
        room_id: selectedRoom.id,
        start_time: selectedStartTime,
        end_time: selectedEndTime,
        notes: bookingNotes,
      };

      await db.createBooking(booking);

      // Refresh bookings data
      await loadData();

      // Show success message
      bookingSuccess = true;

      // Close the form after a delay
      setTimeout(() => {
        closeBookingForm();
      }, 2000);
    } catch (err) {
      console.error("Booking error:", err);
      bookingError =
        err instanceof Error
          ? err.message
          : "Failed to create booking. Please try again.";
    } finally {
      isSubmitting = false;
    }
  }

  // Check if a day is a weekend
  function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
  }

  // Check if a day is today
  function isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  // Update time selectors
  function updateStartTime(timeString: string) {
    if (!selectedStartTime) return;

    const [hour, minutes] = timeString.split(':').map(Number);
    selectedStartTime = new Date(selectedStartTime);
    selectedStartTime.setHours(hour, minutes, 0, 0);

    // Ensure end time is after start time
    if (selectedEndTime && selectedEndTime <= selectedStartTime) {
      selectedEndTime = new Date(selectedStartTime);
      selectedEndTime.setMinutes(selectedStartTime.getMinutes() + 30);
    }
  }

  function updateEndTime(timeString: string) {
    if (!selectedStartTime || !selectedEndTime) return;

    const [hour, minutes] = timeString.split(':').map(Number);
    selectedEndTime = new Date(selectedStartTime);
    selectedEndTime.setHours(hour, minutes, 0, 0);

    // Ensure end time is after start time
    if (selectedEndTime <= selectedStartTime) {
      selectedEndTime = new Date(selectedStartTime);
      selectedEndTime.setMinutes(selectedStartTime.getMinutes() + 30);
    }
  }

  // Helper to check if a time slot has a booking from the same booking id
  function hasPreviousBooking(day: Date, slotIndex: number, roomId: number, bookingId: number): boolean {
    if (slotIndex < 0) return false;

    const dayKey = day.toISOString().split("T")[0];
    const dayBookings = weekBookings[dayKey] || [];

    return dayBookings.some(booking =>
      booking.id === bookingId &&
      booking.room_id === roomId &&
      hasBookingAt(day, slotIndex, roomId)?.id === bookingId
    );
  }

  // Calculate booking height for display
  function getBookingHeight(booking: Booking): number {
    const startDate = new Date(booking.start_time);
    const endDate = new Date(booking.end_time);

    // Calculate number of 15-minute slots
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationMinutes = durationMs / (1000 * 60);
    const slots = Math.ceil(durationMinutes / 15);

    // Each slot is 15px high
    return slots * 15;
  }

  // Format time from hour number (8-24) - kept for compatibility
  function formatHour(hour: number): string {
    if (hour === 12) return "12 PM";
    if (hour > 12) return `${hour - 12} PM`;
    return `${hour} AM`;
  }
</script>

<div class="container mx-auto p-4">
  <div class="flex justify-between items-center mb-4">
    <h1 class="text-2xl font-bold">Phone Room Calendar</h1>
    <button
      on:click={handleSignOut}
      class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-800 text-sm"
    >
      Sign Out
    </button>
  </div>

  {#if isLoading}
    <div class="flex justify-center my-10">
      <div
        class="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"
      ></div>
    </div>
  {:else if error}
    <div
      class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
    >
      <strong class="font-bold">Error!</strong>
      <span class="block sm:inline"> {error}</span>
      <button
        class="bg-indigo-600 text-white px-4 py-2 rounded-md mt-2"
        on:click={loadData}>Retry</button
      >
    </div>
  {:else if filteredRooms.length === 0}
    <div
      class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4"
    >
      <strong class="font-bold">No Rooms Available</strong>
      <span class="block sm:inline">
        No phone rooms were found in the system.</span
      >
    </div>
  {:else}
    <div class="bg-white rounded-lg shadow-md p-4">
      <!-- Calendar Navigation -->
      <div class="flex justify-between items-center mb-4">
        <div class="flex space-x-2">
          <button
            on:click={goToToday}
            class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Today
          </button>
          <button
            on:click={prevWeek}
            class="p-2 rounded-md hover:bg-gray-100"
            aria-label="Previous Week"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            on:click={nextWeek}
            class="p-2 rounded-md hover:bg-gray-100"
            aria-label="Next Week"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
        <h2 class="text-xl font-semibold">
          {new Date(weekDays[0]).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </h2>
      </div>

      <!-- Google Calendar Style Week View -->
      <div class="gcal-grid">
        <!-- Empty corner cell -->
        <div class="gcal-corner"></div>

        <!-- Day headers -->
        {#each weekDays as day}
          <div
            class="gcal-day-header {isWeekend(day) ? 'weekend' : ''} {isToday(day) ? 'today' : ''}"
          >
            <div class="day-name">
              {day.toLocaleDateString("en-US", { weekday: "short" })}
            </div>
            <div class="day-number {isToday(day) ? 'today-circle' : ''}">
              {day.getDate()}
            </div>
          </div>
        {/each}

        <!-- Room rows with time slots -->
        {#each filteredRooms as room}
          <!-- Room name column -->
          <div class="gcal-room-name">
            {room.name}
          </div>

          <!-- Day columns for this room -->
          {#each weekDays as day}
            <div class="gcal-day-column {isWeekend(day) ? 'weekend' : ''} {isToday(day) ? 'today-column' : ''}">
              <!-- Time slots -->
              {#each timeSlots as slot, slotIndex}
                {@const isHourStart = slot.minutes === 0}
                {@const booking = hasBookingAt(day, slotIndex, room.id)}
                {@const isDragged = isDraggedCell(day, slotIndex, room.id)}

                <div
                  class="gcal-time-slot
                         {isHourStart ? 'hour-start' : ''}
                         {booking ? 'booked' : 'available'}
                         {isDragged ? 'dragged' : ''}"
                  on:mousedown={() => handleMouseDown(day, slotIndex, room.id)}
                  on:mouseenter={() => handleMouseEnter(day, slotIndex, room.id)}
                  on:mouseup={handleMouseUp}
                  role="button"
                  tabindex="0"
                  on:keydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      booking ? null : startSelection(day, slotIndex, room.id);
                    }
                  }}
                >
                  {#if booking && isHourStart && !hasPreviousBooking(day, slotIndex - 1, room.id, booking.id)}
                    <!-- Start of a booking -->
                    <div class="booking-display"
                         style="--booking-height: {getBookingHeight(booking)}px;">
                      <div class="booking-time">
                        {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                      </div>
                      <div class="booking-user">
                        {booking.user_id === parseInt($user?.id || "0")
                          ? "Your booking"
                          : "Booked"}
                      </div>
                      {#if booking.notes}
                        <div class="booking-notes" title={booking.notes}>
                          {booking.notes}
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/each}
        {/each}
      </div>
    </div>
  {/if}

  <!-- Google Calendar Style Booking Modal -->
  {#if isBookingFormVisible && selectedRoom && selectedStartTime && selectedEndTime}
    <div
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div
        class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-screen overflow-y-auto"
      >
        {#if bookingSuccess}
          <div class="text-center py-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-12 w-12 mx-auto text-green-500 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <h3 class="text-xl font-medium text-gray-900 mb-2">
              Meeting scheduled
            </h3>
            <p class="text-gray-500">Your booking has been confirmed</p>
            <button
              on:click={closeBookingForm}
              class="mt-4 inline-flex justify-center px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Close
            </button>
          </div>
        {:else}
          <div class="flex justify-between items-center border-b pb-3 mb-4">
            <h3 class="text-lg font-medium text-gray-900">Add event</h3>
            <button
              on:click={closeBookingForm}
              class="text-gray-400 hover:text-gray-500"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <form
            on:submit|preventDefault={handleBookingSubmit}
            class="space-y-4"
          >
            <div class="grid grid-cols-[auto,1fr] gap-4 items-center">
              <!-- Calendar Icon -->
              <div class="text-gray-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <!-- Date field -->
              <div>
                <input
                  type="text"
                  readonly
                  value={formatDate(selectedStartTime)}
                  class="w-full border-none focus:ring-0 p-0 text-gray-900"
                  aria-label="Meeting date"
                />
              </div>

              <!-- Clock Icon -->
              <div class="text-gray-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <!-- Time selector with 15-minute increments -->
              <div class="flex items-center space-x-2">
                <!-- Start time dropdown -->
                <select
                  on:change={(e) => updateStartTime(e.target.value)}
                  class="w-24 border-none focus:ring-0 p-0 text-gray-900 bg-transparent"
                  aria-label="Start time"
                >
                  {#each timeSlots as slot, i}
                    <option
                      value={`${slot.hour}:${slot.minutes}`}
                      selected={selectedStartTime &&
                              selectedStartTime.getHours() === slot.hour &&
                              selectedStartTime.getMinutes() === slot.minutes}
                    >
                      {formatTimeSlot(slot)}
                    </option>
                  {/each}
                </select>

                <span class="text-gray-500">-</span>

                <!-- End time dropdown -->
                <select
                  on:change={(e) => updateEndTime(e.target.value)}
                  class="w-24 border-none focus:ring-0 p-0 text-gray-900 bg-transparent"
                  aria-label="End time"
                >
                  {#each timeSlots as slot, i}
                    {@const slotDateTime = new Date(selectedStartTime);
                     slotDateTime.setHours(slot.hour, slot.minutes, 0, 0)}
                    {#if selectedStartTime && slotDateTime > selectedStartTime}
                      <option
                        value={`${slot.hour}:${slot.minutes}`}
                        selected={selectedEndTime &&
                                selectedEndTime.getHours() === slot.hour &&
                                selectedEndTime.getMinutes() === slot.minutes}
                      >
                        {formatTimeSlot(slot)}
                      </option>
                    {/if}
                  {/each}
                </select>
              </div>

              <!-- Room Icon -->
              <div class="text-gray-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <!-- Room field -->
              <div>
                <input
                  type="text"
                  readonly
                  value={selectedRoom.name}
                  class="w-full border-none focus:ring-0 p-0 text-gray-900"
                  aria-label="Room"
                />
              </div>

              <!-- Notes Icon -->
              <div class="text-gray-400 self-start pt-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </div>
              <!-- Notes field -->
              <div>
                <textarea
                  bind:value={bookingNotes}
                  class="w-full border-none focus:ring-0 p-0 text-gray-900 resize-none"
                  rows="3"
                  placeholder="Add description"
                  aria-label="Meeting description"
                ></textarea>
              </div>
            </div>

            {#if bookingError}
              <div
                class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded"
              >
                <strong class="font-bold">Error:</strong>
                <span class="block sm:inline"> {bookingError}</span>
              </div>
            {/if}

            <div class="flex justify-end pt-4 border-t space-x-3">
              <button
                type="button"
                on:click={closeBookingForm}
                class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Debug information -->
  <div class="mt-4 p-4 bg-gray-100 rounded-lg">
    <h3 class="text-lg font-semibold mb-2">Debug Information</h3>
    <pre class="text-xs overflow-auto">{JSON.stringify(
        debugInfo,
        null,
        2,
      )}</pre>
    <div class="mt-2">
      <button
        on:click={loadData}
        class="bg-blue-500 text-white px-4 py-2 rounded-md text-sm"
      >
        Reload Data
      </button>
    </div>
  </div>
</div>

<style>
  /* Google Calendar style grid layout */
  .gcal-grid {
    display: grid;
    grid-template-columns: 150px repeat(7, 1fr);
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    overflow: hidden;
    background-color: white;
  }

  .gcal-corner {
    grid-column: 1;
    border-bottom: 1px solid #e5e7eb;
    border-right: 1px solid #e5e7eb;
    background-color: #f9fafb;
  }

  .gcal-day-header {
    padding: 8px;
    text-align: center;
    border-bottom: 1px solid #e5e7eb;
    border-right: 1px solid #e5e7eb;
    background-color: #f9fafb;
  }

  .gcal-day-header.weekend {
    background-color: #f3f4f6;
  }

  .gcal-day-header.today {
    background-color: #eef2ff;
  }

  .day-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
  }

  .day-number {
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
    margin-top: 2px;
  }

  .today-circle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background-color: #4f46e5;
    color: white;
    border-radius: 50%;
  }

  .gcal-room-name {
    padding: 8px;
    font-weight: 500;
    color: #4b5563;
    display: flex;
    align-items: center;
    border-right: 1px solid #e5e7eb;
    border-bottom: 1px solid #e5e7eb;
    background-color: #f9fafb;
  }

  .gcal-day-column {
    display: grid;
    grid-template-rows: repeat(68, 15px); /* 17 hours * 4 quarters */
    border-right: 1px solid #e5e7eb;
    position: relative;
  }

  .gcal-day-column.weekend {
    background-color: #f9fafb;
  }

  .gcal-day-column.today-column {
    background-color: #eef2ff;
  }

  .gcal-time-slot {
    border-bottom: 1px solid #f0f0f0;
    position: relative;
    min-height: 15px;
  }

  .gcal-time-slot.hour-start {
    border-bottom: 1px solid #e5e7eb;
  }

  .gcal-time-slot:hover {
    background-color: rgba(79, 70, 229, 0.1);
  }

  .gcal-time-slot.booked {
    background-color: rgba(79, 70, 229, 0.1);
    cursor: default;
  }

  .gcal-time-slot.dragged {
    background-color: rgba(79, 70, 229, 0.2);
    border: 1px dashed #4f46e5;
  }

  .booking-display {
    position: absolute;
    top: 0;
    left: 1px;
    right: 1px;
    height: var(--booking-height, auto);
    padding: 4px;
    font-size: 0.75rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background-color: #4f46e5;
    color: white;
    border-radius: 3px;
    z-index: 10;
  }

  .booking-time {
    font-weight: 500;
    font-size: 0.7rem;
  }

  .booking-user {
    font-size: 0.65rem;
    opacity: 0.9;
  }

  .booking-notes {
    font-size: 0.65rem;
    opacity: 0.9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>

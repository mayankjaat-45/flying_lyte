import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const BookingSuccess = () => {
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [pricing, setPricing] = useState(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("flightBookingData"));

    if (!stored) {
      navigate("/");
      return;
    }

    console.log("BOOKING 👉", stored);

    const raw = stored.booking || stored;

    // 🔥 HANDLE ALL API SHAPES
    let normalized = raw?.data?.Response || raw?.Response || raw;

    // ✅ EXTRA FIX (nested Response inside Response)
    if (normalized?.Response) {
      normalized = normalized.Response;
    }

    setBooking(normalized);
    setPricing(stored.pricing || null);
  }, []);

  if (!booking) {
    return (
      <div className="flex justify-center items-center h-screen text-lg font-semibold">
        Loading your ticket...
      </div>
    );
  }

  const itinerary = booking?.FlightItinerary || {};

  /* ---------------- SAFE DATA ---------------- */

  const passengers = Array.isArray(itinerary?.Passenger)
    ? itinerary.Passenger
    : itinerary?.Passenger
      ? [itinerary.Passenger]
      : [];

  const segments = Array.isArray(itinerary?.Segments)
    ? itinerary.Segments
    : itinerary?.Segments
      ? [itinerary.Segments]
      : [];

  const fare = itinerary?.Fare || {};

  const bookingId =
    itinerary?.BookingId ||
    booking?.BookingId ||
    booking?.Response?.BookingId ||
    "N/A";

  const pnr = itinerary?.PNR || booking?.PNR || booking?.Response?.PNR || "N/A";
  const status = itinerary?.Status === 5 ? "Confirmed" : "Pending";

  /* ---------------- PRICING (LOCKED) ---------------- */

  const stored = JSON.parse(localStorage.getItem("flightBookingData") || "{}");

  const pricingData = stored?.pricing;

  if (!pricingData) {
    console.error("❌ Pricing missing! Redirecting...");
    navigate("/");
    return null;
  }

  const flightFare = Number(pricingData.flightFare);
  const seatPrice = Number(pricingData.seatPrice);
  const mealPrice = Number(pricingData.mealPrice);
  const baggagePrice = Number(pricingData.baggagePrice);
  const convenienceFee = Number(pricingData.convenienceFee);
  const totalFare = Number(pricingData.totalPrice);
  /* ---------------- UI ---------------- */

  return (
    <div className="bg-gray-100 min-h-screen py-20 px-3 md:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="bg-linear-to-r from-green-500 to-emerald-600 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">
              🎉 Booking Confirmed
            </h2>
            <p className="text-sm mt-1 opacity-90">Your e-ticket is ready ✈</p>

            <div className="mt-3 text-sm space-y-1">
              <p>PNR: {pnr}</p>
              <p>Booking ID: {bookingId}</p>
              <p>
                Status: <span className="font-semibold">{status}</span>
              </p>
            </div>
          </div>

          <div className="mt-4 md:mt-0 bg-white text-black px-6 py-3 rounded-xl font-semibold shadow-md">
            ₹ {totalFare}
          </div>
        </div>

        {/* FLIGHTS */}
        {segments.map((seg, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-md p-5 border">
            <div className="flex justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">
                  {seg?.Airline?.AirlineName}
                </h3>
                <p className="text-sm text-gray-500">
                  {seg?.Airline?.AirlineCode}-{seg?.Airline?.FlightNumber}
                </p>
              </div>

              <span className="text-xs bg-blue-50 px-3 py-1 rounded-full">
                {seg?.StopPoint ? "Connecting" : "Non-stop"}
              </span>
            </div>

            <div className="flex justify-between items-center text-center">
              <div>
                <p className="text-xl font-bold">
                  {seg?.Origin?.Airport?.AirportCode}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(seg?.Origin?.DepTime).toLocaleString()}
                </p>
              </div>

              <div>✈</div>

              <div>
                <p className="text-xl font-bold">
                  {seg?.Destination?.Airport?.AirportCode}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(seg?.Destination?.ArrTime).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* PASSENGERS */}
        <div className="bg-white rounded-2xl shadow-md p-5 border">
          <h3 className="font-semibold text-lg mb-4">Passengers</h3>

          {passengers.map((p, i) => (
            <div key={i} className="border-b py-3 text-sm space-y-1">
              <p className="font-medium">
                {p?.Title} {p?.FirstName} {p?.LastName}
              </p>

              <p className="text-gray-500">
                Ticket: {p?.Ticket?.TicketNumber || "N/A"}
              </p>

              <p className="text-gray-500">
                Type: {p?.PaxType === 1 ? "Adult" : "Child"}
              </p>

              {/* <p className="text-gray-500">
                Fare: ₹ {Math.round(p?.Fare?.PublishedFare || 0)}
              </p> */}
            </div>
          ))}
        </div>

        {/* FARE DETAILS */}
        <div className="bg-white rounded-2xl shadow-md p-5 border">
          <h3 className="font-semibold text-lg mb-4">Fare Details</h3>

          <Row label="Flight Fare" value={flightFare} />
          {seatPrice > 0 && <Row label="Seat" value={seatPrice} />}
          {mealPrice > 0 && <Row label="Meal" value={mealPrice} />}
          {baggagePrice > 0 && <Row label="Baggage" value={baggagePrice} />}
          {convenienceFee > 0 && (
            <Row label="Convenience Fee" value={convenienceFee} />
          )}

          <div className="border-t mt-3 pt-3 flex justify-between font-bold">
            <span>Total Paid</span>
            <span>₹ {totalFare}</span>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4">
          <div className="max-w-5xl mx-auto flex gap-4">
            <button
              onClick={() => {
                if (!bookingId || bookingId === "N/A") {
                  alert("Booking ID missing!");
                  return;
                }
                navigate(`/flight-booking-details/${bookingId}`);
              }}
              className="flex-1 bg-gray-200 py-3 rounded-xl"
            >
              View Full Booking
            </button>

            <button
              onClick={() => window.print()}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl"
            >
              Print Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value }) => (
  <div className="flex justify-between text-sm py-1">
    <span className="text-gray-600">{label}</span>
    <span>₹ {value ?? 0}</span>
  </div>
);

export default BookingSuccess;

import { useEffect, useState } from "react";
import { privateApi } from "../../../services/api";
import { useFlightStore } from "../../../store/flightStore";
import { useNavigate } from "react-router-dom";

const SSRPage = () => {
  const {
    traceId,
    resultIndex,
    selectedSeats,
    selectedMeals,
    selectedBaggage,
    setSelectedMeals,
    setSelectedSeats,
    setSelectedBaggage,
    passengerCount,
    fareQuote,
  } = useFlightStore();

  const [baggage, setBaggage] = useState([]);
  const [meals, setMeals] = useState([]);
  const [seatRows, setSeatRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  /* ---------------- Utils ---------------- */
  const getPrice = (val) => Number(val || 0);

  /* ---------------- Session Guard ---------------- */
  useEffect(() => {
    if (!traceId || !resultIndex) {
      navigate("/");
    }
  }, [traceId, resultIndex, navigate]);

  /* ---------------- Seat Click ---------------- */
  const handleSeatClick = (seat) => {
    // assign seat to next unassigned passenger
    let updatedSeats = [...selectedSeats];

    // find passenger without seat
    for (let i = 0; i < passengerCount; i++) {
      const alreadyAssigned = updatedSeats.find((s) => s.PassengerIndex === i);

      if (!alreadyAssigned) {
        updatedSeats.push({
          ...seat,
          PassengerIndex: i, // 🔥 IMPORTANT
        });
        setSelectedSeats(updatedSeats);
        return;
      }
    }

    alert("All passengers already have seats");
  };

  /* ---------------- Meal Click ---------------- */
  const handleMealSelect = (meal) => {
    let updated = [...selectedMeals];

    for (let i = 0; i < passengerCount; i++) {
      const exists = updated.find((m) => m.PassengerIndex === i);

      if (!exists) {
        updated.push({
          ...meal,
          PassengerIndex: i,
        });
        setSelectedMeals(updated);
        return;
      }
    }

    alert("All passengers already have meals");
  };

  /* ---------------- Baggage Click ---------------- */
  const handleBaggageSelect = (bag) => {
    if (bag.Code === "NO_BAGGAGE") {
      setSelectedBaggage([]);
      return;
    }

    let updated = [];

    for (let i = 0; i < passengerCount; i++) {
      updated.push({
        ...bag,
        PassengerIndex: i, // 🔥 CRITICAL
      });
    }

    setSelectedBaggage(updated);
  };

  /* ---------------- Seat Renderer ---------------- */
  const renderSeat = (seat) => {
    const unavailable = seat.AvailablityType === 0;
    const isSelected = selectedSeats.some((s) => s.Code === seat.Code);
    const price = getPrice(seat.Price);

    return (
      <button
        key={seat.Code}
        disabled={unavailable}
        onClick={() => handleSeatClick(seat)}
        className={`w-12 h-12 rounded-md text-[10px] flex flex-col justify-center items-center border
        ${
          unavailable
            ? "bg-gray-300 text-gray-500"
            : isSelected
              ? "bg-green-600 text-white"
              : price > 0
                ? "bg-yellow-400"
                : "bg-white hover:bg-gray-100"
        }`}
      >
        <span>{seat.Code}</span>
        {price > 0 && <span className="text-[9px]">₹{price}</span>}
      </button>
    );
  };

  /* ---------------- Fetch SSR ---------------- */
  const fetchSSR = async () => {
    try {
      setLoading(true);

      const res = await privateApi.post("/api/airlines/ssr/", {
        TraceId: traceId,
        ResultIndex: resultIndex,
      });

      const response = res?.data?.Response;

      setMeals(response?.MealDynamic?.flat() || []);
      setBaggage(response?.Baggage?.flat() || []);
      const allSeats =
        response?.SeatDynamic?.flatMap((seg) =>
          seg.SegmentSeat?.flatMap((s) => s.RowSeats || []),
        ) || [];

      setSeatRows(allSeats.map((row) => row.Seats || []));
    } catch (err) {
      setError("Failed to load SSR data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (traceId && resultIndex) fetchSSR();
  }, [traceId, resultIndex]);

  /* ---------------- Price ---------------- */

  /* ---------------- Price ---------------- */

  const pricing = fareQuote?.Pricing || {};

  const flightFare = Number(pricing?.TBOFare || 0);
  const convenienceFee = Number(pricing?.ConvenienceFee || 0);

  // SSR totals
  // SSR totals
  const seatsTotal = selectedSeats.reduce((t, s) => t + getPrice(s.Price), 0);
  const mealsTotal = selectedMeals.reduce((t, m) => t + getPrice(m.Price), 0);
  const baggageTotal = selectedBaggage.reduce(
    (t, b) => t + getPrice(b.Price),
    0,
  );

  // ✅ FINAL TOTAL (API + SSR)
  const finalTotal =
    flightFare + seatsTotal + mealsTotal + baggageTotal + convenienceFee;
  /* ---------------- Derived ---------------- */
  const paidBaggage = baggage.filter((b) => getPrice(b.Price) > 0);

  const noBaggageOption = {
    Code: "NO_BAGGAGE",
    Price: 0,
  };

  /* ---------------- UI ---------------- */

  if (loading)
    return (
      <div className="h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  if (error)
    return (
      <div className="h-screen flex items-center justify-center text-red-600">
        {error}
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h2 className="text-xl font-bold mb-8">Select Add-ons</h2>

      {/* Meals */}
      <div className="mb-10">
        <h3 className="font-semibold mb-3">Meals</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {meals.map((meal) => {
            const isSelected = selectedMeals.some((m) => m.Code === meal.Code);

            return (
              <button
                key={meal.Code}
                onClick={() => handleMealSelect(meal)}
                className={`p-3 border rounded ${
                  isSelected ? "bg-blue-600 text-white" : ""
                }`}
              >
                {meal.AirlineDescription || meal.Code}
                {getPrice(meal.Price) > 0 && <div>₹{meal.Price}</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Baggage */}
      <div className="mb-10">
        <h3 className="font-semibold mb-3">Baggage</h3>

        {paidBaggage.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* NO BAGGAGE */}
              <button
                onClick={() => handleBaggageSelect(noBaggageOption)}
                className={`p-3 border rounded ${
                  selectedBaggage.length === 0 ? "bg-gray-800 text-white" : ""
                }`}
              >
                No Extra Baggage
                <div>₹0</div>
              </button>

              {/* Paid */}
              {paidBaggage.map((bag) => {
                const isSelected = selectedBaggage.some(
                  (b) => b.Code === bag.Code,
                );

                return (
                  <button
                    key={bag.Code}
                    onClick={() => handleBaggageSelect(bag)}
                    className={`p-3 border rounded ${
                      isSelected ? "bg-purple-600 text-white" : ""
                    }`}
                  >
                    {bag.Weight} KG
                    <div>₹{getPrice(bag.Price)}</div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-gray-500">No additional baggage available.</div>
        )}
      </div>

      {/* Seats */}
      <div className="mb-10">
        <h3>
          Seats ({selectedSeats.length}/{passengerCount})
        </h3>

        {seatRows.map((row, i) => (
          <div key={i} className="flex gap-2 justify-center mb-2">
            {row.map(renderSeat)}
          </div>
        ))}
      </div>

      {/* Price */}
      <div className="border p-4 rounded mb-6 bg-white shadow">
        <h3 className="font-semibold mb-3">Fare Summary</h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Flight Fare</span>
            <span>₹{flightFare}</span>
          </div>

          {seatsTotal > 0 && (
            <div className="flex justify-between">
              <span>Seat Charges</span>
              <span>₹{seatsTotal}</span>
            </div>
          )}

          {mealsTotal > 0 && (
            <div className="flex justify-between">
              <span>Meal Charges</span>
              <span>₹{mealsTotal}</span>
            </div>
          )}

          {baggageTotal > 0 && (
            <div className="flex justify-between">
              <span>Baggage Charges</span>
              <span>₹{baggageTotal}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span>Convenience Fee</span>
            <span>₹{convenienceFee}</span>
          </div>

          {/* <div className="flex justify-between">
            <span>GST (18%)</span>
            <span>₹{gst}</span>
          </div> */}

          <hr />

          <div className="flex justify-between font-bold text-lg">
            <span>Total Payable</span>
            <span>₹{finalTotal}</span>
          </div>
        </div>
      </div>
      {/* Continue */}
      {/* Continue */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            // ✅ guard for missing passengerCount
            if (!passengerCount) {
              alert("Passenger count missing. Please restart booking.");
              return;
            }

            // ✅ validation instead of disabled
            if (selectedSeats.length !== passengerCount) {
              alert(`Please select ${passengerCount} seats`);
              return;
            }

            navigate("/passenger-details", {
              state: {
                selectedSeats,
                selectedMeals,
                selectedBaggage,
                traceId,
                resultIndex,
                fareQuote,
              },
            });
          }}
          className={`px-6 py-3 rounded text-white transition
      ${
        selectedSeats.length === passengerCount
          ? "bg-blue-600 hover:bg-blue-700"
          : "bg-gray-400 cursor-not-allowed"
      }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default SSRPage;

import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { privateApi, publicApi } from "../../services/api";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { useAuthStore } from "../../store/authStore";
import SEO from "../../components/SEO";

const SITE_URL = "https://www.flyinglyte.com";

const fetchPackage = async (slug) => {
  const res = await publicApi.get(`/api/package/packages/${slug}/`);
  return res.data?.data || res.data;
};

const PackageDetails = () => {
  const navigate = useNavigate();
  const { slug } = useParams();

  const [openItinerary, setOpenItinerary] = useState(false);
  const [openInclusions, setOpenInclusions] = useState(false);
  const [openExclusions, setOpenExclusions] = useState(false);
  const [openBookingForm, setOpenBookingForm] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const token = useAuthStore((state) => state.token);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    adults: 1,
    children: 0,
    date: "",
    request: "",
  });

  const {
    data: pkg = null,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["package", slug],
    queryFn: () => fetchPackage(slug),
    enabled: !!slug,
  });

  const handleBookClick = () => {
    if (!token) {
      navigate("/login", {
        state: {
          redirectTo: `/packages/${slug}`,
          openBooking: true,
        },
      });
      return;
    }

    setOpenBookingForm(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const updateCount = (type, value) => {
    setFormData((prev) => {
      const minValue = type === "adults" ? 1 : 0;

      return {
        ...prev,
        [type]: Math.max(minValue, Number(prev[type]) + value),
      };
    });
  };

  const createBooking = async (bookingData) => {
    const res = await privateApi.post(
      "/api/package/packages/book/",
      bookingData,
    );

    return res.data;
  };

  const bookingMutation = useMutation({
    mutationFn: createBooking,

    onSuccess: async (res) => {
      const booking = res?.data;

      if (!booking) {
        toast.error("Booking response not found");
        return;
      }

      toast.success("Booking created. Redirecting to payment...");

      try {
        localStorage.setItem("packageBookingData", JSON.stringify(booking));

        const paymentPayload = {
          amount: String(Math.round(Number(booking.total_price) || 0)),
          firstname: booking.customer?.name || formData.name,
          email: booking.customer?.email || formData.email,
          phone: booking.customer?.phone || formData.phone,
        };

        const paymentRes = await privateApi.post(
          "/payment/initiate/",
          paymentPayload,
        );

        if (typeof paymentRes.data === "string") {
          const container = document.createElement("div");
          container.innerHTML = paymentRes.data;
          container.style.display = "none";

          document.body.appendChild(container);

          const form = container.querySelector("#payuForm");

          if (form) {
            form.submit();
            return;
          }

          throw new Error("Payment form not found");
        }

        toast.error("Invalid payment response");
      } catch (err) {
        console.log("PAYMENT ERROR:", err);
        toast.error("Payment initiation failed");
      }
    },

    onError: (error) => {
      console.log("PACKAGE BOOKING ERROR:", error);
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Package booking failed",
      );
    },
  });

  if (isLoading) {
    return <div className="p-10 text-center text-white">Loading...</div>;
  }

  if (isError || !pkg) {
    return (
      <>
        <SEO
          title="Package Not Found"
          description="The requested travel package could not be found."
          canonical={`${SITE_URL}/packages/${slug}`}
        />

        <div className="min-h-screen bg-(--bg-main) text-white flex items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-3xl text-red-400 font-semibold mb-4">
              Package not found
            </h1>

            <button
              onClick={() => navigate("/packages")}
              className="px-5 py-3 rounded-xl bg-(--gold-main) text-black font-semibold"
            >
              Back to Packages
            </button>
          </div>
        </div>
      </>
    );
  }

  const itineraryDays =
    pkg.Itinery?.split(";")
      ?.map((d) => d.trim())
      ?.filter(Boolean) || [];

  const inclusions =
    pkg.Inclusion?.split(/\r?\n|,|\./)
      ?.map((item) => item.trim())
      ?.filter(Boolean) || [];

  const exclusions =
    pkg.Exclusion?.split(/\r?\n|,|\./)
      ?.map((item) => item.trim())
      ?.filter(Boolean) || [];

  const pricePerPerson = Number(pkg.price) || 0;

  const totalPassengers = Math.max(
    1,
    Number(formData.adults || 0) + Number(formData.children || 0),
  );

  const totalPrice = pricePerPerson * totalPassengers;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (
      !formData.name ||
      !formData.email ||
      !formData.phone ||
      !formData.adults ||
      !formData.date
    ) {
      toast.error("Please fill required fields");
      return;
    }

    if (!token) {
      toast.error("Please login to book package");
      navigate("/login", {
        state: {
          redirectTo: `/packages/${slug}`,
          openBooking: true,
        },
      });
      return;
    }

    bookingMutation.mutate({
      package_id: pkg.id,
      package_name: pkg.tour_name || pkg.title,
      travel_date: formData.date,
      adults: Number(formData.adults),
      children: Number(formData.children),
      total_passengers: totalPassengers,
      total_price: totalPrice,
      customer: {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
      },
      request: formData.request,
    });
  };

  // Dynamic SEO
  const seoTitle =
    pkg.seo_title || pkg.title || pkg.tour_name || "Travel Package";

  const seoDescription =
    pkg.seo_description ||
    pkg.description ||
    "Explore this travel package with FlyingLyte.";

  const canonicalUrl = `${SITE_URL}/packages/${pkg.slug || slug}`;

  const seoImage = pkg.images?.[0]?.image || `${SITE_URL}/og-image.jpg`;

  const seoKeywords = [
    pkg.tour_name,
    pkg.title,
    pkg.Country_City_Multicity,
    "travel package",
    "holiday package",
    "FlyingLyte",
  ]
    .filter(Boolean)
    .join(", ");

  const packageSchema = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: pkg.tour_name || pkg.title,
    description: seoDescription,
    image: pkg.images?.map((img) => img.image) || [],
    url: canonicalUrl,
    touristType: "Travelers",
    itinerary: pkg.Itinery,
    offers: {
      "@type": "Offer",
      price: String(pkg.price || "0"),
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: canonicalUrl,
    },
    ...(pkg.rating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: String(pkg.rating),
        bestRating: "5",
        worstRating: "1",
        ratingCount: "1",
      },
    }),
  };

  //whatsApp Enquiry
  const WHATSAPP_NUMBER = "919667455591";

  const handleWhatsappInquiry = () => {
    const packageName = pkg.tour_name || pkg.title || "Travel Package";
    const destination = pkg.Country_City_Multicity || "N/A";
    const duration = `${pkg.days || ""} Days / ${pkg.Number_of_nights || ""} Nights`;
    const price = Number(pkg.price || 0).toLocaleString();
    const packageUrl = `${SITE_URL}/packages/${pkg.slug || slug}`;

    const message = `
Hello FlyingLyte,

I want to inquire about this travel package:

Package: ${packageName}
Destination: ${destination}
Duration: ${duration}
Starting Price: ₹${price} per person
Package Link: ${packageUrl}

Please share more details.
`;

    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      message,
    )}`;

    window.open(whatsappUrl, "_blank");
  };

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonical={canonicalUrl}
        image={seoImage}
        type="product"
        keywords={seoKeywords}
        jsonLd={packageSchema}
      />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-(--bg-main) text-white min-h-screen pb-20"
      >
        {/* HERO / PREMIUM IMAGE GALLERY */}
        <div className="max-w-7xl mx-auto px-4 pt-26">
          <button
            onClick={() => navigate("/packages")}
            className="mb-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
          >
            ← Back to Packages
          </button>

          <h1 className="text-2xl md:text-4xl font-(--font-hero) text-(--gold-main) mb-2">
            {pkg.tour_name || pkg.title}
          </h1>

          <p className="text-gray-400 mb-6">{pkg.Country_City_Multicity}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-xl overflow-hidden">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="col-span-2 md:col-span-2 md:row-span-2 h-60 md:h-full cursor-pointer"
              onClick={() => setSelectedImage(pkg.images?.[0]?.image)}
            >
              <img
                src={
                  pkg.images?.[0]?.image || "/images/package-placeholder.jpg"
                }
                alt={pkg.tour_name || pkg.title || "Package image"}
                className="w-full h-full object-cover hover:scale-105 active:scale-95 transition"
              />
            </motion.div>

            {pkg.images?.slice(1, 5).map((img, index) => (
              <motion.div
                key={img.id || index}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="h-32 md:h-full cursor-pointer overflow-hidden"
                onClick={() => setSelectedImage(img.image)}
              >
                <img
                  src={img.image}
                  alt={`${pkg.tour_name || pkg.title} ${index + 2}`}
                  className="w-full h-full object-cover hover:scale-105 active:scale-95 transition"
                />
              </motion.div>
            ))}
          </div>
        </div>

        {/* IMAGE LIGHTBOX */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
              onClick={() => setSelectedImage(null)}
            >
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-5 right-5 text-white text-3xl"
              >
                ✕
              </button>

              <motion.img
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                src={selectedImage}
                alt={pkg.tour_name || pkg.title || "Selected package"}
                className="max-w-full max-h-[85vh] object-contain rounded-xl"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* SUMMARY */}
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <motion.div
            whileHover={{ y: -6 }}
            transition={{ duration: 0.25 }}
            className="bg-(--bg-card) p-4 md:p-6 rounded-xl text-center"
          >
            <p className="text-xs md:text-sm text-gray-400">Duration</p>
            <p className="text-base md:text-xl font-semibold">
              {pkg.days} Days / {pkg.Number_of_nights} Nights
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -6 }}
            transition={{ duration: 0.25 }}
            className="bg-(--bg-card) p-4 md:p-6 rounded-xl text-center"
          >
            <p className="text-xs md:text-sm text-gray-400">Rating</p>
            <p className="text-base md:text-xl font-semibold">
              ⭐ {pkg.rating || "N/A"}
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -6 }}
            transition={{ duration: 0.25 }}
            className="bg-(--bg-card) p-4 md:p-6 rounded-xl text-center"
          >
            <p className="text-xs md:text-sm text-gray-400">Starting Price</p>
            <p className="text-base md:text-xl font-semibold text-(--gold-main)">
              ₹{pricePerPerson.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">Per Person</p>
          </motion.div>

          <motion.div
            whileHover={{ y: -6 }}
            transition={{ duration: 0.25 }}
            className="bg-(--bg-card) p-4 md:p-6 rounded-xl text-center"
          >
            <div className="space-y-3">
              <button
                onClick={handleBookClick}
                className="w-full bg-linear-to-r from-start to-end text-black font-semibold py-3 rounded-xl"
              >
                Book Now
              </button>

              <button
                onClick={handleWhatsappInquiry}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
              >
                WhatsApp Inquiry
              </button>
            </div>
          </motion.div>
        </div>

        {/* CONTENT */}
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-3 gap-8">
          {/* LEFT */}
          <div className="lg:col-span-2 space-y-8">
            {/* DESCRIPTION */}
            <div className="bg-(--bg-card) p-6 md:p-8 rounded-2xl">
              <h2 className="text-xl md:text-2xl font-(--font-heading) text-(--gold-main) mb-4">
                Tour Overview
              </h2>

              <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                {pkg.description}
              </p>
            </div>

            {/* ITINERARY */}
            <div className="bg-(--bg-card) p-6 md:p-8 rounded-2xl">
              <button
                onClick={() => setOpenItinerary(!openItinerary)}
                className="w-full flex justify-between items-center"
              >
                <h2 className="text-xl md:text-2xl font-(--font-heading) text-(--gold-main)">
                  Itinerary
                </h2>

                <span className="text-xl">{openItinerary ? "−" : "+"}</span>
              </button>

              <AnimatePresence>
                {openItinerary && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="space-y-5 mt-6 overflow-hidden"
                  >
                    {itineraryDays.length > 0 ? (
                      itineraryDays.map((day, index) => (
                        <div key={index} className="flex gap-3 md:gap-4">
                          <div className="min-w-8 h-8 md:w-10 md:h-10 rounded-full bg-(--gold-main) text-black flex items-center justify-center text-sm md:text-base font-bold">
                            {index + 1}
                          </div>

                          <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                            {day}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 text-sm">
                        Itinerary not available.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* INCLUSIONS / EXCLUSIONS */}
            <div className="bg-(--bg-card) p-6 md:p-8 rounded-2xl grid md:grid-cols-2 gap-6">
              {/* INCLUSIONS */}
              <div className="bg-black/20 p-6 md:p-8 rounded-2xl">
                <button
                  onClick={() => setOpenInclusions(!openInclusions)}
                  className="w-full flex justify-between items-center"
                >
                  <h3 className="text-lg md:text-xl font-semibold text-green-400">
                    Inclusions
                  </h3>

                  <span className="text-xl">{openInclusions ? "−" : "+"}</span>
                </button>

                <AnimatePresence>
                  {openInclusions && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-2 text-gray-300 text-sm md:text-base mt-5 overflow-hidden"
                    >
                      {inclusions.length > 0 ? (
                        inclusions.map((item, i) => <li key={i}>✔ {item}</li>)
                      ) : (
                        <li className="text-gray-400">
                          Inclusions not available.
                        </li>
                      )}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>

              {/* EXCLUSIONS */}
              <div className="bg-black/20 p-6 md:p-8 rounded-2xl">
                <button
                  onClick={() => setOpenExclusions(!openExclusions)}
                  className="w-full flex justify-between items-center"
                >
                  <h3 className="text-lg md:text-xl font-semibold text-red-400">
                    Exclusions
                  </h3>

                  <span className="text-xl">{openExclusions ? "−" : "+"}</span>
                </button>

                <AnimatePresence>
                  {openExclusions && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-2 text-gray-300 text-sm md:text-base mt-5 overflow-hidden"
                    >
                      {exclusions.length > 0 ? (
                        exclusions.map((item, i) => (
                          <li key={i}>✘ {item.replace("✘", "").trim()}</li>
                        ))
                      ) : (
                        <li className="text-gray-400">
                          Exclusions not available.
                        </li>
                      )}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div>
            <div className="lg:sticky lg:top-24 bg-(--bg-card) p-6 md:p-8 rounded-2xl border border-(--border-soft)">
              <h3 className="text-sm md:text-lg text-gray-400 mb-2">
                Starting From
              </h3>

              <p className="text-2xl md:text-3xl font-bold text-(--gold-main) mb-6">
                ₹{Number(totalPrice).toLocaleString()}
              </p>

              <div className="space-y-2">
                <button
                  onClick={handleBookClick}
                  className="bg-linear-to-r from-start to-end text-black px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold w-full text-sm md:text-base"
                >
                  Book Now
                </button>

                <button
                  onClick={handleWhatsappInquiry}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold w-full text-sm md:text-base transition"
                >
                  WhatsApp Inquiry
                </button>
              </div>

              <div className="mt-6 text-xs md:text-sm text-gray-400 space-y-2">
                <p>✔ Instant confirmation</p>
                <p>✔ Secure payment</p>
                <p>✔ 24/7 support</p>
              </div>
            </div>
          </div>
        </div>

        {/* BOOKING MODAL */}
        <AnimatePresence>
          {openBookingForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-center items-end md:items-center p-3 md:p-6 overflow-y-auto"
            >
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="bg-(--bg-card) w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col"
              >
                {/* HEADER */}
                <div className="flex items-center justify-between border-b border-gray-700 p-4 md:p-6 sticky top-0 bg-(--bg-card) z-10">
                  <h2 className="text-lg md:text-2xl font-(--font-heading) text-(--gold-main)">
                    Book Package
                  </h2>

                  <button
                    onClick={() => setOpenBookingForm(false)}
                    className="text-gray-400 hover:text-white text-xl"
                  >
                    ✕
                  </button>
                </div>

                {/* BODY */}
                <div className="overflow-y-auto p-4 md:p-6 space-y-6">
                  {/* PACKAGE SUMMARY */}
                  <div className="bg-black/30 border border-gray-700 p-4 rounded-xl space-y-2 text-sm">
                    <p>
                      <span className="text-gray-400">Package :</span>{" "}
                      <span className="text-white font-semibold">
                        {pkg.tour_name || pkg.title}
                      </span>
                    </p>

                    <p>
                      <span className="text-gray-400">Destination :</span>{" "}
                      {pkg.Country_City_Multicity}
                    </p>

                    <p>
                      <span className="text-gray-400">Duration :</span>{" "}
                      {pkg.days} Days / {pkg.Number_of_nights} Nights
                    </p>

                    <p>
                      <span className="text-gray-400">Price :</span>{" "}
                      <span className="text-(--gold-main) font-semibold">
                        ₹{pricePerPerson.toLocaleString()}{" "}
                        <span className="text-gray-400">/ person</span>
                      </span>
                    </p>
                  </div>

                  {/* FORM */}
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* NAME */}
                    <div>
                      <label className="text-sm text-gray-400">Full Name</label>
                      <input
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        type="text"
                        placeholder="Enter your name"
                        className="w-full mt-1 p-3 rounded-lg bg-black/30 border border-gray-600 focus:border-(--gold-main) focus:ring-1 focus:ring-(--gold-main) outline-none"
                      />
                    </div>

                    {/* EMAIL + PHONE */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-400">Email</label>
                        <input
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          type="email"
                          placeholder="Email address"
                          className="w-full mt-1 p-3 rounded-lg bg-black/30 border border-gray-600 focus:border-(--gold-main) outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-sm text-gray-400">Phone</label>
                        <input
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          type="tel"
                          placeholder="Phone number"
                          className="w-full mt-1 p-3 rounded-lg bg-black/30 border border-gray-600 focus:border-(--gold-main) outline-none"
                        />
                      </div>
                    </div>

                    {/* PASSENGERS */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* ADULTS */}
                      <div className="bg-black/30 border border-gray-700 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-400">Adults</p>
                          <p className="text-lg font-semibold">
                            {formData.adults}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => updateCount("adults", -1)}
                            className="w-8 h-8 rounded bg-gray-700 hover:bg-gray-600"
                          >
                            −
                          </button>

                          <button
                            type="button"
                            onClick={() => updateCount("adults", 1)}
                            className="w-8 h-8 rounded bg-(--gold-main) text-black font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* CHILDREN */}
                      <div className="bg-black/30 border border-gray-700 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-400">Children</p>
                          <p className="text-lg font-semibold">
                            {formData.children}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => updateCount("children", -1)}
                            className="w-8 h-8 rounded bg-gray-700 hover:bg-gray-600"
                          >
                            −
                          </button>

                          <button
                            type="button"
                            onClick={() => updateCount("children", 1)}
                            className="w-8 h-8 rounded bg-(--gold-main) text-black font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* TRAVEL DATE */}
                    <div>
                      <label className="text-sm text-gray-400">
                        Travel Date
                      </label>
                      <input
                        name="date"
                        value={formData.date}
                        onChange={handleChange}
                        type="date"
                        className="w-full mt-1 p-3 rounded-lg bg-black/30 border border-gray-600 focus:border-(--gold-main) outline-none"
                      />
                    </div>

                    {/* SPECIAL REQUEST */}
                    <div>
                      <label className="text-sm text-gray-400">
                        Special Requests
                      </label>
                      <textarea
                        name="request"
                        value={formData.request}
                        onChange={handleChange}
                        rows="3"
                        placeholder="Optional message..."
                        className="w-full mt-1 p-3 rounded-lg bg-black/30 border border-gray-600 focus:border-(--gold-main) outline-none"
                      />
                    </div>

                    {/* PRICE SUMMARY */}
                    <div className="bg-black/30 border border-gray-700 p-4 rounded-xl text-sm space-y-2">
                      <p>
                        <span className="text-gray-400">Passengers :</span>{" "}
                        {totalPassengers}
                      </p>

                      <p>
                        <span className="text-gray-400">
                          Price Per Person :
                        </span>{" "}
                        ₹{pricePerPerson.toLocaleString()}
                      </p>

                      <p className="text-lg font-bold text-(--gold-main)">
                        Total Price : ₹{totalPrice.toLocaleString()}
                      </p>
                    </div>

                    {/* SUBMIT BUTTON */}
                    <motion.button
                      type="submit"
                      disabled={bookingMutation.isPending}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="bg-linear-to-r from-start to-end text-black py-3 rounded-xl font-semibold w-full disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {bookingMutation.isPending
                        ? "Processing..."
                        : "Confirm Booking"}
                    </motion.button>
                  </form>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};

export default PackageDetails;

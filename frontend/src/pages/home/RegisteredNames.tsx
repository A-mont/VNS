import React, { useEffect, useState } from "react";



function RegisteredNames() {
  const [names, setNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRegisteredNames = async () => {
    try {
      const response = await fetch("http://localhost:5000/registered-names");
      if (!response.ok) {
        throw new Error("Failed to fetch registered names");
      }
      const data = await response.json();
      setNames(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegisteredNames();
  }, []);

  if (loading) return <p>Loading registered names...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">Recently Registered Names</h2>
      <ul>
        {names.map((name) => (
          <li key={name.id} className="mb-2">
            {name.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { RegisteredNames}
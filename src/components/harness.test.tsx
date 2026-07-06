import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

function Hello() {
  return <p>RosterHouse test harness works</p>;
}

describe("test harness", () => {
  it("renders a React component into jsdom with jest-dom matchers", () => {
    render(<Hello />);
    expect(
      screen.getByText("RosterHouse test harness works")
    ).toBeInTheDocument();
  });
});

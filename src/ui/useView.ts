import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

/**
 * A view that opens over a page: kept in the page's address, so that the
 * browser's back closes it and a reload keeps it.
 *
 * Closing it goes back where it was opened from here, so that back does not
 * open it again; where the address arrived with it already open - a reload,
 * a link - there is nowhere to go back to, and it is taken out of the address.
 */
export const useView = (name: string) => {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const without = (now: URLSearchParams) => {
    const next = new URLSearchParams(now);
    next.delete(name);
    return next;
  };
  return {
    open: params.get(name) === "1",
    show: () =>
      setParams(
        (now) => {
          const next = new URLSearchParams(now);
          next.set(name, "1");
          return next;
        },
        { state: { opened: name } },
      ),
    close: () => {
      if ((location.state as { opened?: string } | null)?.opened === name) navigate(-1);
      else setParams(without, { replace: true });
    },
  };
};

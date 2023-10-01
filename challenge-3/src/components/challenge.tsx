import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { VStack, useToast, Divider} from '@chakra-ui/react';
import ToolBar from "@/components/ToolBar";
import DomainSearch from "@/components/DomainSearch";
import DomainBadge from "@/components/DomainBadge";
import DomainActions from "@/components/DomainActions";
import DomainFilter from "@/components/DomainFilter";
import DomainList from "@/components/DomainList";

/**
 * Props type for the Challenge component.
 * @interface
 * @property {number} maxDomains - Maximum number of domains to be selected.
 */
interface ChallengeProps {
    maxDomains: number;
}

/**
 * Type for individual domain information.
 * @interface
 * @property {string} name - The domain name.
 * @property {boolean} [available] - Availability status of the domain.
 * @property {boolean} [isLoading] - Loading status of the domain.
 */
export interface DomainInfo {
    name: string;
    available?: boolean;
    isLoading?: boolean;
}

/**
 * Validate if a given string is a valid domain name.
 * @param {string} domain - The domain name to validate.
 * @returns {boolean} True if the domain name is valid, otherwise false.
 *
 * Regex obtained from chatGPT
 */
const isValidDomain = (domain: string): boolean => {
    const regex = /^(?!:\/\/)([a-zA-Z0-9-]+)\.(com|xyz|app)$/;
    return regex.test(domain);
};


/**
 * Main component for the Challenge application.
 * Manages the domain selection, filtering, and purchasing functionalities.
 * @param {ChallengeProps} props - Props for the Challenge component.
 */
export function Challenge({ maxDomains }: ChallengeProps) {
    const [cart, setCart] = useState<DomainInfo[]>([]);
    const [domainInput, setDomainInput] = useState<string>('');
    const [unavailableDomains, setUnavailableDomains] = useState<number>(0);
    const [availableDomains, setAvailableDomains] = useState<number>(0);
    const [cartHistory, setCartHistory] = useState<DomainInfo[][]>([]);

    const [filterQuery, setFilterQuery] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('Name');
    const [filteredCart, setFilteredCart] = useState<DomainInfo[]>([]);

    const [redoStack, setRedoStack] = useState<DomainInfo[][]>([]);
    const [isSmallScreen, setSmallScreen] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const toast = useToast();

    // Save to Local Storage whenever cart changes
    useEffect(() => {
        localStorage.setItem('cart', JSON.stringify(cart));
        console.log(localStorage)
    }, [cart]);

    // Read from Local Storage when component mounts
    useEffect(() => {
        const storedCart = localStorage.getItem('cart');
        if (storedCart) setCart(JSON.parse(storedCart));
    }, []);

    useEffect(() => {
        const checkScreenSize = () => { setSmallScreen(window.innerWidth < 768); };
        checkScreenSize();
        // Listen for window resize
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    useEffect(() => {
        const filtered: DomainInfo[] = (() => {
            if (filterType === 'Name') {
                return cart.filter(domain =>
                    domain.name.toLowerCase().includes(filterQuery.toLowerCase())
                );
            }
            if (filterType === 'Available') {
                return cart.filter(domain => domain.available === true);
            }
            if (filterType === 'Unavailable') {
                return cart.filter(domain => domain.available === false);
            }
            return [];
        })();
        setFilteredCart(filtered);
    }, [filterQuery, filterType, cart]);



    useEffect(() => {
        const checkDomains = async (): Promise<void> => {
            const promises: Promise<void>[] = cart.map(async (domain: DomainInfo, index: number): Promise<void> => {
                if (domain.available !== undefined || domain.isLoading) return;
                try {
                    const updatedCart: DomainInfo[] = [...cart];
                    updatedCart[index].isLoading = true;
                    setCart(updatedCart);
                    const res: Response = await fetch(`/api/checkDomain?domain=${domain.name}`);
                    const data = await res.json();
                    const updatedCartAfterCheck: DomainInfo[] = [...cart];
                    updatedCartAfterCheck[index].available = data.available;
                    updatedCartAfterCheck[index].isLoading = false;
                    setCart(updatedCartAfterCheck);
                } catch (error) {
                    console.error(`Error checking domain availability: ${error}`);
                    toast({
                        title: "Error",
                        description: `Failed to check domain: ${domain.name}`,
                        status: "error",
                        duration: 3000,
                        isClosable: true,
                    });
                }
            });
            await Promise.all(promises);
        };
        checkDomains();
    }, [cart, toast]);

    useEffect(() => {
        const { availableCount, unavailableCount } = cart.reduce(
            (acc, domain: DomainInfo) => {
                if (domain.available) {
                    acc.availableCount++;
                } else if (domain.available === false) {
                    acc.unavailableCount++;
                }
                return acc;
            },
            { availableCount: 0, unavailableCount: 0 }
        );
        setAvailableDomains(availableCount);
        setUnavailableDomains(unavailableCount);
    }, [cart]);


    /**
     * Save the current state of the cart to history for undo functionality.
     * @param {DomainInfo[]} currentCart - The current state of the cart.
     */
    const addActionToHistory = (currentCart: DomainInfo[]): void => {
        if (Array.isArray(currentCart)) {
            setCartHistory([...cartHistory, [...currentCart]]);
        } else {
            console.error("currentCart is not an array:", currentCart);
        }
    };

    /**
     * Redo the last undone action, if any.
     * Restores the cart to the state before the last undo operation.
     *
     * Implemented using a stack to keep track of previous actions
     */
    const redoLastAction = (): void => {
        if (redoStack.length > 0) {
            const lastState: DomainInfo[] = redoStack[redoStack.length - 1];
            setCart([...lastState]);
            setCartHistory([...cartHistory, cart]);
            setRedoStack(redoStack.slice(0, -1));
        } else {
            toast({
                title: "Nothing to Redo",
                description: "You haven't undone any actions that can be redone.",
                status: "info",
                duration: 2000,
                isClosable: true,
            });
        }
    };


    /**
     * Undo the last action, if any.
     * Reverts the cart to the previous state.
     */
    const undoLastAction = (): void => {
        if (cartHistory.length > 0) {
            const lastState: DomainInfo[] = cartHistory[cartHistory.length - 1];
            setCart([...lastState]);
            setRedoStack([...redoStack, cart]);
            setCartHistory(cartHistory.slice(0, -1));
        } else {
            toast({
                title: "Nothing to Undo",
                description: "You don't have any actions that can be undone.",
                status: "info",
                duration: 2000,
                isClosable: true,
            });
        }
    };


    /**
     * Add a new domain to the cart.
     * Uses the `domainInput` state to read the new domain name.
     */
    const addDomainToCart = useCallback((): void => {
        if (isValidDomain(domainInput)) {
            const newDomain = { name: domainInput.toLowerCase(), isLoading: false };
            if (!cart.some(d => d.name === newDomain.name)) {
                setCart([...cart, newDomain]);
                addActionToHistory(cart);
                toast({
                    title: "Domain Added",
                    description: `${domainInput} has been added to the cart.`,
                    status: "success",
                    duration: 2000,
                    isClosable: true,
                });
            }
        } else {
            toast({
                title: "Invalid Domain",
                description: "The domain must end with .com, .xyz, or .app and should not contain any paths or protocols.",
                status: "warning",
                duration: 3000,
                isClosable: true,
            });
        }
    }, [domainInput, cart, cartHistory]);

    /**
     * Remove a domain from the cart.
     * @param {string} domain - The name of the domain to remove.
     */
    const removeDomainFromCart = useCallback((domain: string): void => {
        setCart(cart.filter(d => d.name !== domain));
        toast({
            title: "Domain Removed",
            description: `${domain} has been removed from the cart.`,
            status: "info",
            duration: 2000,
            isClosable: true,
        });
    }, [cart]);


    /**
     * Determines whether the Purchase button should be disabled.
     * @type {boolean}
     */
    const isPurchaseDisabled: boolean = useMemo(() => {
        return availableDomains !== maxDomains || unavailableDomains > 0;
    }, [availableDomains, maxDomains, unavailableDomains]);


    /**
     * Clear all domains from the cart.
     */
    const clearCart = useCallback((): void => {
        addActionToHistory(cart);
        setCart([]);
        toast({
            title: "Cart Cleared",
            description: "All domains have been removed from the cart.",
            status: "info",
            duration: 2000,
            isClosable: true,
        });
    }, [toast, cart, cartHistory]);


    /**
     * Remove all unavailable domains from the cart.
     */
    const removeUnavailableDomains = useCallback((): void => {
        setCart(cart.filter(d => d.available));
        addActionToHistory(cart);
        toast({
            title: "Unavailable Domains Removed",
            description: "All unavailable domains have been removed from the cart.",
            status: "info",
            duration: 2000,
            isClosable: true,
        });
    }, [cart, toast]);

    /**
     * Copy the names of all domains in the cart to the clipboard.
     */
    const copyDomainsToClipboard = useCallback((): void => {
        const domainNames: string = cart.map(d => d.name).join(", ");
        navigator.clipboard.writeText(domainNames);
        toast({
            title: "Domains Copied",
            description: "Domains have been copied to clipboard.",
            status: "success",
            duration: 2000,
            isClosable: true,
        });
    }, [cart, toast]);

    /**
     * Handle the purchase action.
     * Opens a modal and clears the cart if the purchase is possible.
     */
    const handlePurchase = (): void => {
        if (!isPurchaseDisabled) {
            setIsOpen(true);  // Open the modal
            setCart([]);  // Clear the cart
        }
    };

    /**
     * Keep only the best domains in the cart based on certain criteria.
     */
    const keepBestDomains = useCallback(() => {
        const sortedCart: DomainInfo[] = [...cart].sort((a, b) => {
            // Prioritize available domains over unavailable ones
            if (a.available && !b.available) return -1;
            if (!a.available && b.available) return 1;

            // If both are either available or unavailable, proceed with further sorting
            const domainA = a.name.split('.');
            const domainB = b.name.split('.');
            // Banned domain endings
            const extOrder = ['.com', '.app', '.xyz'];
            const extA = extOrder.indexOf(domainA[1]);
            const extB = extOrder.indexOf(domainB[1]);

            // Sort by domain extension
            if (extA !== extB) return extA - extB;

            // Sort by domain length
            return domainA[0].length - domainB[0].length;
        });
        setCart(sortedCart.slice(0, maxDomains));
        addActionToHistory(cart);
        toast({
            title: "Best Domains Kept",
            description: `Only the best ${maxDomains} domains are now in the cart.`,
            status: "success",
            duration: 2000,
            isClosable: true,
        });
    }, [cart, maxDomains, toast]);


    /**
     * Update the name of a domain in the cart.
     * @param {string} newName - The new name for the domain.
     * @param {number} index - The index of the domain in the cart.
     */
    const handleDomainNameChange = useCallback((newName: string, index: number): void => {
        const updatedCart: DomainInfo[] = [...cart];
        updatedCart[index].name = newName;
        updatedCart[index].available = undefined;
        updatedCart[index].isLoading = false;
        setCart(updatedCart);
    }, [cart]);

    const shouldRenderDivider: boolean = unavailableDomains > 0 || availableDomains > 0 || !isPurchaseDisabled;

    return (
        <VStack spacing={4} direction={{ base: "column", md: "row" }}>
            <DomainActions
                isSmallScreen={isSmallScreen}
                availableDomains={availableDomains}
                unavailableDomains={unavailableDomains}
                maxDomains={maxDomains}
                isPurchaseDisabled={isPurchaseDisabled}
                isOpen={isOpen}
                handlePurchase={handlePurchase}
                setIsOpen={setIsOpen}
            />
            <DomainBadge
                isSmallScreen={isSmallScreen}
                availableDomains={availableDomains}
                unavailableDomains={unavailableDomains}
                maxDomains={maxDomains}
            />
            <DomainSearch
                shouldRenderDivider={shouldRenderDivider}
                domainInput={domainInput}
                setDomainInput={setDomainInput}
                addDomainToCart={addDomainToCart}
            />
            <Divider style={{ backgroundColor: 'black', height: '2px'}} />
            <ToolBar
                isSmallScreen={isSmallScreen}
                clearCart={clearCart}
                removeUnavailableDomains={removeUnavailableDomains}
                copyDomainsToClipboard={copyDomainsToClipboard}
                keepBestDomains={keepBestDomains}
                undoLastAction={undoLastAction}
                redoLastAction={redoLastAction}
            />
            <Divider style={{ backgroundColor: 'black', height: '2px'}} />
            <DomainFilter
                availableDomains={availableDomains}
                unavailableDomains={unavailableDomains}
                filterQuery={filterQuery}
                filterType={filterType}
                setFilterQuery={setFilterQuery}
                setFilterType={setFilterType}
            />
            <DomainList
                filteredCart={filteredCart}
                handleDomainNameChange={handleDomainNameChange}
                removeDomainFromCart={removeDomainFromCart}
            />
        </VStack>
    );
}

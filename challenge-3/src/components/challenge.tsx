import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    VStack,
    Box,
    Text,
    IconButton,
    Button,
    useToast,
    Badge,
    Avatar,
    Tooltip,
    HStack,
    Input,
    Alert,
    AlertIcon,
    Select,
    Stat,
    StatLabel,
    Divider,
    StatGroup, StatHelpText, StatNumber,
    Heading
} from '@chakra-ui/react';
import { FaTrash, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import { Spinner } from '@chakra-ui/react';



interface ChallengeProps {
    maxDomains: number;
}

interface DomainInfo {
    name: string;
    available?: boolean;
    isLoading?: boolean;
}

const isValidDomain = (domain: string): boolean => {
    const regex = /^(?!:\/\/)([a-zA-Z0-9-]+)\.(com|xyz|app)$/;
    return regex.test(domain);
};


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

    const toast = useToast();

    // Save to Local Storage whenever cart changes
    useEffect(() => {
        localStorage.setItem('cart', JSON.stringify(cart));
        console.log(localStorage)
    }, [cart]);

    // Read from Local Storage when component mounts
    useEffect(() => {
        const storedCart = localStorage.getItem('cart');
        console.log(storedCart)
        if (storedCart) {
            setCart(JSON.parse(storedCart));
        }
    }, []);

    useEffect(() => {
        const checkScreenSize = () => {
            setSmallScreen(window.innerWidth < 768);
        };
        // Initial check
        checkScreenSize();
        // Listen for window resize
        window.addEventListener('resize', checkScreenSize);

        // Cleanup
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    useEffect(() => {
        let filtered: DomainInfo[] = [];
        if (filterType === 'Name') {
            filtered = cart.filter(domain =>
                domain.name.toLowerCase().includes(filterQuery.toLowerCase())
            );
        } else if (filterType === 'Available') {
            filtered = cart.filter(domain => domain.available === true);
        } else if (filterType === 'Unavailable') {
            filtered = cart.filter(domain => domain.available === false);
        }
        setFilteredCart(filtered);
    }, [filterQuery, filterType, cart]);




    useEffect(() => {
        const checkDomains = async () => {
            const promises = cart.map(async (domain, index) => {
                if (domain.available !== undefined || domain.isLoading) return;

                try {
                    const updatedCart = [...cart];
                    updatedCart[index].isLoading = true;
                    setCart(updatedCart);

                    const res = await fetch(`/api/checkDomain?domain=${domain.name}`);
                    const data = await res.json();

                    const updatedCartAfterCheck = [...cart];
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

    // Second useEffect for counting available and unavailable domains
    useEffect(() => {
        let availableCount = 0;
        let unavailableCount = 0;

        cart.forEach((domain) => {
            if (domain.available) {
                availableCount++;
            } else if (domain.available === false) {
                unavailableCount++;
            }
        });

        setAvailableDomains(availableCount);
        setUnavailableDomains(unavailableCount);
    }, [cart]);

    const addActionToHistory = (currentCart: DomainInfo[]) => {
        if (Array.isArray(currentCart)) {
            setCartHistory([...cartHistory, [...currentCart]]);
        } else {
            console.error("currentCart is not an array:", currentCart);
        }
    };

    const redoLastAction = () => {
        if (redoStack.length > 0) {
            const lastState = redoStack[redoStack.length - 1];
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


    const undoLastAction = () => {
        if (cartHistory.length > 0) {
            const lastState = cartHistory[cartHistory.length - 1];
            setCart([...lastState]);
            setRedoStack([...redoStack, cart]);
            setCartHistory(cartHistory.slice(0, -1));
        }
    };

    const addDomainToCart = useCallback(() => {
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

    const removeDomainFromCart = useCallback((domain: string) => {
        setCart(cart.filter(d => d.name !== domain));
        toast({
            title: "Domain Removed",
            description: `${domain} has been removed from the cart.`,
            status: "info",
            duration: 2000,
            isClosable: true,
        });
    }, [cart]);

    const isPurchaseDisabled = useMemo(() => {
        return availableDomains !== maxDomains || unavailableDomains > 0;
    }, [availableDomains, maxDomains, unavailableDomains]);

    const keepBestDomainsLogic = () => {
        const sortedCart = [...cart].sort((a, b) => {
            const domainA = a.name.split('.');
            const domainB = b.name.split('.');
            const extOrder = ['.com', '.app', '.xyz'];
            const extA = extOrder.indexOf(domainA[1]);
            const extB = extOrder.indexOf(domainB[1]);

            if (extA !== extB) return extA - extB;
            return domainA[0].length - domainB[0].length;
        });

        setCart(sortedCart.slice(0, maxDomains));
    };

    const clearCart = useCallback(() => {
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

    const removeUnavailableDomains = useCallback(() => {
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

    const copyDomainsToClipboard = useCallback(() => {
        const domainNames = cart.map(d => d.name).join(", ");
        navigator.clipboard.writeText(domainNames);
        toast({
            title: "Domains Copied",
            description: "Domains have been copied to clipboard.",
            status: "success",
            duration: 2000,
            isClosable: true,
        });
    }, [cart, toast]);

    const keepBestDomains = useCallback(() => {
        const sortedCart = [...cart].sort((a, b) => {
            // Prioritize available domains over unavailable ones
            if (a.available && !b.available) return -1;
            if (!a.available && b.available) return 1;

            // If both are either available or unavailable, proceed with further sorting
            const domainA = a.name.split('.');
            const domainB = b.name.split('.');
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


    const handleDomainNameChange = useCallback((newName: string, index: number) => {
        const updatedCart = [...cart];
        updatedCart[index].name = newName;
        // Re-check availability if needed
        updatedCart[index].available = undefined;
        updatedCart[index].isLoading = false;
        setCart(updatedCart);
    }, [cart]);

    const shouldRenderDivider = unavailableDomains > 0 || availableDomains > 0 || !isPurchaseDisabled;

    return (
        <VStack spacing={4} direction={{ base: "column", md: "row" }}>
            <HStack spacing={4} direction={{ base: "column", md: "row" }}>
                {unavailableDomains == 0 && availableDomains === maxDomains && (
                    <Alert status="success" variant="left-accent">
                        <AlertIcon />
                        <StatGroup>
                            <Stat>
                                <StatLabel>Added Available Domains</StatLabel>
                                <StatNumber>{availableDomains}</StatNumber>
                                <StatHelpText>
                                    {maxDomains} Max
                                </StatHelpText>
                            </Stat>
                        </StatGroup>
                    </Alert>
                )}
                {availableDomains >= 1 && availableDomains < maxDomains && (
                    <Alert status="info" variant="left-accent">
                        <AlertIcon />
                        <StatGroup>
                            <Stat>
                                <StatLabel>Added Available Domains</StatLabel>
                                <StatNumber>{availableDomains}</StatNumber>
                                <StatHelpText>
                                    {maxDomains} Max
                                </StatHelpText>
                            </Stat>
                        </StatGroup>
                    </Alert>
                )}

                {availableDomains > maxDomains && (
                    <Alert status="warning" variant="left-accent">
                        <AlertIcon />
                        <Text fontWeight="bold">
                            Please remove {availableDomains - maxDomains} available {(availableDomains - maxDomains == 1) ? "domain": "domains"} to match the limit.
                        </Text>
                    </Alert>
                )}

                {unavailableDomains > 0 && (
                    <Alert status="warning" variant="left-accent">
                        <AlertIcon />
                        <Text fontWeight="bold">
                            Please remove {unavailableDomains} unavailable {unavailableDomains == 1 ? "domain" : "domains"}.
                        </Text>
                    </Alert>
                )}

                {!isPurchaseDisabled && (
                    <Button
                        size="lg"               // Larger button size
                        colorScheme="teal"      // A different color scheme
                        variant="solid"         // Solid button
                        boxShadow="md"          // Add a little box-shadow for depth
                        _hover={{ boxShadow: "lg" }}  // Increase box-shadow on hover for a nice effect
                    >
                        Purchase
                    </Button>
                )}
            </HStack>

            {
                isSmallScreen ?
                    (
                        <VStack spacing={4}>
                            {availableDomains > 0 && <Badge colorScheme="green">Available Domains: {availableDomains}</Badge>}
                            {unavailableDomains > 0 && <Badge colorScheme="red">Unavailable Domains: {unavailableDomains}</Badge>}
                            {availableDomains > maxDomains && <Badge colorScheme="yellow">Please remove extra domains</Badge>}
                        </VStack>
                    ) :
                    (
                        <HStack spacing={4} direction={{ base: "column", md: "row" }}>
                            {availableDomains > 0 && <Badge colorScheme="green">Available Domains: {availableDomains}</Badge>}
                            {unavailableDomains > 0 && <Badge colorScheme="red">Unavailable Domains: {unavailableDomains}</Badge>}
                            {availableDomains > maxDomains && <Badge colorScheme="yellow">Please remove extra domains</Badge>}
                        </HStack>
                    )
            }


            {!shouldRenderDivider && (
                <Heading m={0} p={0}>
                    <span style={{ color: "green" }}>Search </span>
                    <span style={{ color: "black" }}>for </span>
                    <span style={{ color: "green" }}>Domains </span>
                    <span style={{ color: "black" }}>to </span>
                    <span style={{ color: "green" }}>Buy!</span>
                </Heading>
            )}
            {shouldRenderDivider && <Divider style={{ backgroundColor: 'black', height: '2px' }} />}

            <HStack>
                <Input

                    placeholder="Enter a domain name"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                />
                <Button w="170px" onClick={addDomainToCart}>Add to Cart</Button>
            </HStack>

            <Divider style={{ backgroundColor: 'black', height: '2px'}} />


            <div>
                {
                    isSmallScreen ?
                        (
                            <VStack spacing={4}>
                                <Button onClick={clearCart}>Clear Cart</Button>
                                <Button onClick={removeUnavailableDomains}>Remove Unavailable Domains</Button>
                                <Button onClick={copyDomainsToClipboard}>Copy Domains to Clipboard</Button>
                                <Button onClick={keepBestDomains}>Keep Best Domains</Button>
                                <HStack spacing={4}>
                                    <Button onClick={undoLastAction}>Undo</Button>
                                    <Button onClick={redoLastAction}>Redo</Button>
                                </HStack>
                            </VStack>
                        ) :
                        (
                            <HStack spacing={4}>
                                <Button onClick={clearCart}>Clear Cart</Button>
                                <Button onClick={removeUnavailableDomains}>Remove Unavailable Domains</Button>
                                <Button onClick={copyDomainsToClipboard}>Copy Domains to Clipboard</Button>
                                <Button onClick={keepBestDomains}>Keep Best Domains</Button>
                                <Button onClick={undoLastAction}>Undo</Button>
                                <Button onClick={redoLastAction}>Redo</Button>
                            </HStack>
                        )
                }
            </div>
            <Divider style={{ backgroundColor: 'black', height: '2px'}} />

            {(availableDomains > 0 || unavailableDomains > 0) && (
                <HStack spacing={4} direction={{ base: "column", md: "row" }}>
                    <Input
                        placeholder="Filter domains"
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        disabled={filterType === "Available" || filterType === "Unavailable"}
                    />
                    <Select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="Name">Name</option>
                        <option value="Available">Available</option>
                        <option value="Unavailable">Unavailable</option>
                    </Select>

                </HStack>
            )}

            <Box w="100%" maxW="md">
                {filteredCart.map((d, index) => (
                    <Box key={index} display="flex" alignItems="center" p={4} border="1px" borderColor="gray.200" borderRadius="md">
                        <Avatar
                            size="sm"
                            icon={d.isLoading ? <Spinner /> : d.available ? <FaCheck /> : <FaExclamationTriangle />}
                            mr={4}
                        />
                        <Box w="200px">
                            <Input
                                value={d.name}
                                onChange={(e) => handleDomainNameChange(e.target.value, index)}
                            />
                        </Box>
                        <Box w="150px" textAlign="center">
                            {d.isLoading ? (
                                <Spinner size="sm" />
                            ) : (
                                <Badge colorScheme={d.available ? 'green' : 'red'}>
                                    {d.available ? 'Available' : 'Unavailable'}
                                </Badge>
                            )}
                        </Box>
                        <Tooltip label="Remove" aria-label="A tooltip" ml={4}>
                            <IconButton
                                aria-label="Remove"
                                icon={<FaTrash />}
                                onClick={() => removeDomainFromCart(d.name)}
                            />
                        </Tooltip>
                    </Box>
                ))}
            </Box>
        </VStack>
    );
}
